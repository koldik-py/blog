CREATE DATABASE blog;

CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL -- храните хеш пароля, а не сам пароль
);

CREATE TABLE articles (
    id SERIAL PRIMARY KEY,
    publication_date TIMESTAMP NOT NULL,
    text TEXT NOT NULL,
    user_id INTEGER REFERENCES users(id)
);