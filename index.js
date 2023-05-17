require('dotenv').config();
const express = require('express');
const app = express();
const cors = require('cors');

const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const pool = require("./db");

app.use(cors());
app.use(express.json());

const path = require("path");


// routes

// create
app.post("/api/users/add", async(request, response) => {
  try {
    const { name, email, password } = request.body;

    // хеш пароля
    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = await pool.query(
      "INSERT INTO users (name, email, password) VALUES ($1, $2, $3) RETURNING *",
      [name, email, hashedPassword]
    );

    response.json(newUser.rows[0]);

  } catch (err) {
    console.error(err.message)
  }
});

function auth(req, res, next) {
  const token = req.header('Authorization').replace('Bearer ', '');
  if (!token) return res.status(401).send('Access Denied');

  try {
    const verified = jwt.verify(token, process.env.JWT_SECRET);
    req.user = verified;
    next();
  } catch (err) {
    res.status(400).send('Invalid Token');
  }
}

app.get("/api/users/profile", auth, async (req, res) => {
  try {
    const user = await pool.query("SELECT id, name, email FROM users WHERE id = $1", [req.user.user_id]);
    res.json(user.rows[0]);
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server error");
  }
});
// login
app.post("/api/users/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    // Проверка пользователя
    const user = await pool.query("SELECT * FROM users WHERE email = $1", [email]);

    if (user.rows.length === 0) {
      return res.status(401).json("Invalid Credential");
    }

    // Проверка пароля
    const validPassword = await bcrypt.compare(password, user.rows[0].password);

    if (!validPassword) {
      return res.status(401).json("Invalid Credential");
    }

    // Создание токена JWT
    const token = jwt.sign({ user_id: user.rows[0].id }, process.env.JWT_SECRET, {
      expiresIn: "1h"
    });

    // Исключение пароля из ответа
    const { password: userPassword, ...userInfo } = user.rows[0];

    res.json({ token, user: userInfo });

  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server error");
  }
});


// Получить по id
app.get("/users/:id", async(request, response) => {
  try {
    const { id } = request.params;

    const user = await pool.query("SELECT * FROM users WHERE id = $1;", [id]);

    response.json(user.rows)

  } catch (errow) {
    console.error(errow.message)
  }
})

// изменить по id
app.put("/:table/:id", async(request, response) => {
  try {
    const { table, id } = request.params;

    let userDetails = Object.entries(request.body).map(([key, value]) => ({ [key]: value }));

    // Хеширование пароля, если он присутствует
    for (let obj of userDetails) {
      if (Object.keys(obj)[0] === 'password') {
        obj.password = await bcrypt.hash(obj.password, 10);
      }
    }

    const setString = userDetails.map((obj, index) => `${Object.keys(obj)[0]} = $${index + 1}`).join(', ');
    const values = userDetails.map(obj => Object.values(obj)[0]);

    const query = `UPDATE ${table} SET ${setString} WHERE id = $${values.length + 1}`;
    const user = await pool.query(query, [...values, id]);

    response.json({
      id: id,
      updatedFields: userDetails
    });

  } catch (error) {
    console.error(error.message);
  }
});

// ARTICLE

app.post("/api/articles/add", auth, async (req, res) => {
  try {

    const { text } = req.body;
    const user_id = req.user.user_id;

    const newArticle = await pool.query(
      "INSERT INTO articles (text, user_id, publication_date) VALUES ($1, $2, NOW()) RETURNING *",
      [text, user_id]
    );

    res.json(newArticle.rows[0]);
  } catch (err) {
    res.status(500).send("Server error");
  }
});

app.get("/api/articles", async (req, res) => {
  try {
    const allArticles = await pool.query(
      "SELECT articles.id, articles.publication_date, articles.text, users.name AS author FROM articles INNER JOIN users ON articles.user_id = users.id"
    );
    res.json(allArticles.rows);
  } catch (err) {
    console.error(err.message);
  }
});

app.delete("/api/articles/:id", auth, async (req, res) => {
  try {
    const { id } = req.params; // Получаем ID статьи из параметров URL

    const deletedArticle = await pool.query(
      "DELETE FROM articles WHERE id = $1 RETURNING *",
      [id]
    );

    if (deletedArticle.rows.length === 0) {
      return res.status(404).json({ message: "No article found with this ID" });
    }

    res.json(deletedArticle.rows[0]);
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server error");
  }
});

app.put("/api/articles/:id", auth, async (req, res) => {
  try {
    const { id } = req.params;
    const { text } = req.body;
    const user_id = req.user.user_id; // это предполагает, что у вас есть middleware для аутентификации, который устанавливает req.user

    // Проверка, является ли пользователь владельцем статьи
    const article = await pool.query("SELECT * FROM articles WHERE id = $1", [id]);

    if (article.rows.length === 0) {
      return res.status(404).send("Article not found");
    }

    if (article.rows[0].user_id !== user_id) {
      return res.status(403).send("User not authorized");
    }

    // Обновление статьи
    const updatedArticle = await pool.query(
      "UPDATE articles SET text = $1 WHERE id = $2 RETURNING *",
      [text, id]
    );

    res.json(updatedArticle.rows[0]);
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server error");
  }
});


const port = 5555

app.use(express.static(path.join(__dirname, "build")));

app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "build", "index.html"));
});
const port = 5555;
app.listen(port, () => {
  console.log(`Server is running on port ${port}`)
})
