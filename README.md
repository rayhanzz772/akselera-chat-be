# 🚀 Express Template (Node.js + Sequelize + Zod)

A clean, modern, and scalable **Express.js project template** built for real-world backend development.  
This template follows a **modular structure**, supports **Sequelize ORM**, **Zod validation**, and includes helpers for clean response handling and validation.

---

## 🧱 Features

✅ Modular architecture (controllers, routes, middlewares, utils)  
✅ Sequelize ORM (with CLI migrations & models under `/db/`)  
✅ Zod for schema-based validation  
✅ Centralized API response formatter  
✅ Error-handling middleware  
✅ Environment variable configuration with `dotenv`  
✅ Ready for REST API projects or as backend for fullstack apps  

---

## 📂 Folder Structure

```

express-template/
├── src/
│   ├── routes/                # Route definitions
│   │   └── index.js
│   ├── controllers/           # Controller logic
│   │   └── example.controller.js
│   ├── middlewares/           # Global middlewares
│   ├── utils/                 # Helper functions (api, validation, etc.)
│   │   ├── api.js
│   │   └── validation.js
│   └── config/
│       └── config.js          # dotenv loader and config manager
│
├── db/
│   ├── models/                # Sequelize models
│   ├── migrations/            # Migration files
│   ├── seeders/               # Seeder files
│   └── config/config.json     # Sequelize DB config
│
├── .env.example               # Sample environment variables
├── .sequelizerc               # Sequelize CLI paths configuration
├── .gitignore
├── package.json
└── README.md

````

---

## ⚙️ Installation

Clone the repository:

```bash
git clone https://github.com/rayhanzz772/express-template.git
cd express-template
````

Install dependencies:

```bash
npm install
```

---

## 🧾 Environment Setup

Create a `.env` file based on `.env.example`:

```
PORT=5000
NODE_ENV=development

DB_DIALECT=postgres
DB_HOST=localhost
DB_USER=postgres
DB_PASS=123456
DB_NAME=express_template
```

---

## 🧩 Database Setup (Sequelize)

Initialize Sequelize project (if needed):

```bash
npx sequelize-cli init
```

Run migrations:

```bash
npx sequelize-cli db:migrate
```

Undo migration (optional):

```bash
npx sequelize-cli db:migrate:undo
```

---

## 🧠 Validation Example (Zod)

Each request schema is defined using **Zod** for strict validation.

Example:
`src/modules/user/schema.js`

```js
const { z } = require('zod')

const listSchema = z.object({
  per_page: z.string().regex(/^\d+$/).transform(Number).optional(),
  page: z.string().regex(/^\d+$/).transform(Number).optional(),
  q: z.string().trim().optional().nullable()
})

module.exports = { listSchema }
```

And used in controller:

```js
const { listSchema } = require('./schema')
const { validateRequest } = require('../../utils/validation')

const query = validateRequest(listSchema, req, 'query')
```

---

## 🧱 API Example

### Controller

```js
static async getUser(req, res) {
  try {
    const query = validateRequest(listSchema, req, 'query')
    const users = await db.User.findAll()
    return res.status(200).json(api.results(users, 200))
  } catch (err) {
    console.error(err)
    return res.status(500).json(api(null, 500, { err }))
  }
}
```

### Route

```js
const router = require('express').Router()
const UserController = require('../controllers/user.controller')

router.get('/users', UserController.getUser)

module.exports = router
```

---

## 🧰 Scripts

| Command                             | Description                         |
| ----------------------------------- | ----------------------------------- |
| `npm run dev`                       | Run development server with Nodemon |
| `npm start`                         | Run production server               |
| `npx sequelize-cli db:migrate`      | Run all migrations                  |
| `npx sequelize-cli db:seed:all`     | Run all seeders                     |
| `npx sequelize-cli db:migrate:undo` | Rollback last migration             |

---

## 🔒 API Response Format

Unified JSON format via `api.results()` and `api()` helpers:

```json
{
  "success": true,
  "message": "OK",
  "metadata": {},
  "data": { ... }
}
```

Error example:

```json
{
  "success": false,
  "message": "Validation failed",
  "metadata": {},
  "data": null
}
```

---

## 🧑‍💻 Author

**Rayhan Z**
Backend Developer | Node.js & Express Enthusiast
🔗 [GitHub](https://github.com/rayhanzz772)

---

## 🪄 License

This project is licensed under the **MIT License**.
Feel free to use and modify for your own backend projects.

---

> 💡 *Tip:* Fork this repo as your boilerplate backend for all new projects — just replace `/modules` content with your own logic, and you’re ready to build production-grade APIs!

---
