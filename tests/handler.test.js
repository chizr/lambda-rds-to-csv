import * as handler from '../handler';

/* global test, expect */

xtest('exportTables', async () => {
  const event = 'event';
  const context = 'context';
  const callback = (error, response) => {
    expect(response.statusCode).toEqual(200);
    expect(typeof response.body).toBe('string');
  };

  await handler.exportTable(event, context, callback);
});
