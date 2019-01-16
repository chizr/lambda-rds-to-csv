const mysql = require('mysql');
const fs = require('fs');
const csvWriter = require('csv-write-stream');
const AWS = require('aws-sdk');

const S3 = new AWS.S3({
  httpOptions: {
    connectTimeout: 1000,
  },
});

const envConnVars = {
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
};

const mysqlConn = mysql.createConnection({
  ...envConnVars,
  connectTimeout: 500,
});

/**
 * @param {String} query
 * @param {?Array<String, *>} args
 */
const performQuery = (query, args = []) => new Promise((resolve, reject) => {
  mysqlConn.query(query, args, (err, results) => {
    if (err) {
      mysqlConn.destroy();
      return reject(new Error(`Query failed: ${err}`));
    }
    return resolve(results);
  });
});

/**
 * @param {String} tableName
 * @param {Number} minId
 * @param {?Number} maxId
 * @param {?String[]} fields
 */
const getRows = async (tableName, minId = 0, maxId = null, fields = []) => {
  const flds = fields.length ? fields.join(',') : '*';
  return performQuery(`SELECT ${flds} FROM ${tableName} WHERE id BETWEEN ? AND ?`, [minId, maxId]);
};

/**
 * @param {String} tableName
 * @param {Date} start
 * @param {?Date} end
 */
const getMinMaxIdForDateRange = async (tableName, start, end = new Date()) => performQuery(
  `SELECT MIN(id) as minId, MAX(id) as maxId from ${tableName} WHERE created_at BETWEEN ? AND ?`,
  [start, end],
);

const uploadToS3 = params => new Promise((resolve, reject) => {
  S3.putObject(params, err => (err ? reject(err) : resolve(params.Key)));
});

const serialise = (row) => {
  const serialisedRow = {};
  Object.keys(row).forEach((k) => {
    const val = row[k];
    if (val instanceof Date) {
      serialisedRow[k] = val.getTime() / 1000;
      return;
    }
    serialisedRow[k] = val;
  });
  return serialisedRow;
};

/**
 * @param {Object} event
 * @param {String} event.table
 * @param {?Number} event.year
 */
export const exportTable = async (event) => { // eslint-disable-line import/prefer-default-export, max-len
  if (!event.table) {
    throw new Error('No table name supplied');
  }

  const exportYear = event.year || 2018;

  const tableName = event.table;
  const fileName = `${tableName}-${exportYear}.csv`;
  const filePath = `/tmp/${fileName}`;

  const uploadedFiles = [];
  let entityIds = [];
  let data = [];

  try {
    entityIds = Object.assign({}, (await getMinMaxIdForDateRange(
      tableName,
      new Date(exportYear, 0, 1),
      new Date(exportYear + 1, 0, 1),
    ))[0]);
    data = await getRows(tableName, entityIds.minId, entityIds.maxId);
    const writer = csvWriter();

    const ws = fs.createWriteStream(filePath);

    const waitForFile = () => new Promise((resolve) => {
      ws.on('finish', () => resolve(fs.readFileSync(filePath)));
    });

    writer.pipe(ws);

    data.forEach((r) => {
      const row = serialise(r);
      writer.write(row);
    });
    writer.end();
    await waitForFile();
  } catch (err) {
    return {
      statusCode: 500,
      body: {
        table: tableName,
        error: err,
      },
    };
  }

  const bucketParams = {
    Bucket: 'bucket-goes-here',
    Key: fileName,
    Body: fs.readFileSync(filePath).toString('utf-8'),
  };

  try {
    const s3UploadResult = await uploadToS3(bucketParams);
    uploadedFiles.push(s3UploadResult);
  } catch (uploadErr) {
    return {
      statusCode: 500,
      body: {
        uploadErr,
      },
    };
  }

  return {
    ids: entityIds,
    rows: data.length,
    statusCode: 200,
    body: JSON.stringify({
      uploadedFiles,
      message: `Successfully exported ${tableName}}`,
    }),
  };
};

process
  .on('uncaughtException', () => {
    mysqlConn.end();
    process.exit(1);
  })
  .on('exit', () => mysqlConn.end());
