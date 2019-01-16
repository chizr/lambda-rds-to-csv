# RDS to CSV on AWS Lambda

A Serverless project for exporting CSV data to S3, because trying to get AWS data pipeline working with Aurora was a lot of messing about.

Note that it is somewhat specific to my needs at this time (I'm accessing rows which all have a `created_at` column and need data a year at a time), but the basic building blocks might be useful to someone. Maybe?

### Requirements

- [Install the Serverless Framework](https://serverless.com/framework/docs/providers/aws/guide/installation/)
- [Configure your AWS CLI](https://serverless.com/framework/docs/providers/aws/guide/credentials/)

### Usage

### Installation

``` bash
$ yarn
```

#### Run unit tests

Coming soon to a computer near you...

``` bash
$ yarn test
```

#### Run a function on your local

``` bash
$ serverless invoke local --function exportTable --data '{"table": "<table name>"}'
```

#### Deploy

``` bash
$ serverless deploy
```

To add environment variables to your project

1. Rename `env.example` to `env.yml`.
2. Add environment variables for the various stages to `env.yml`.
3. Uncomment `environment: ${file(env.yml):${self:provider.stage}}` in the `serverless.yml`.
