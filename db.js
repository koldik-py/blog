const Pool = require('pg').Pool;

const pool = new Pool(
  {
    user: "ilyabelyshev",
    password: "420356",
    host: "localhost",
    port: 5432,
    database: "blog"
  }
)

module.exports = pool;