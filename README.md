# Akselera Chat Backend

Backend REST API dan realtime transport untuk aplikasi internal web chat Akselera.Tech.
Project ini menyediakan authentication, user management, private conversation, encrypted message storage, unread message tracking, dan realtime notification menggunakan Socket.IO.

## Daftar Isi

- [Overview](#overview)
- [Arsitektur](#arsitektur)
- [Teknologi](#teknologi)
- [Struktur Project](#struktur-project)
- [Persiapan](#persiapan)
- [Konfigurasi Environment](#konfigurasi-environment)
- [Database](#database)
- [Menjalankan Project](#menjalankan-project)
- [API Endpoint](#api-endpoint)
- [Realtime dengan Socket.IO](#realtime-dengan-socketio)
- [Security](#security)
- [Format Response](#format-response)
- [Testing Flow](#testing-flow)
- [Troubleshooting](#troubleshooting)

## Overview

Backend ini dirancang untuk aplikasi chat private dengan prinsip berikut:

- User harus login sebelum mengakses conversation atau message.
- Akses conversation diverifikasi melalui tabel `conversation_members`.
- Password disimpan sebagai hash satu arah menggunakan Argon2id.
- Message tidak menyimpan plaintext.
- Enkripsi dan dekripsi message dilakukan oleh client menggunakan AES-256-GCM.
- Backend hanya menyimpan `ciphertext`, `iv`, dan `auth_tag`.
- Message baru disebarkan secara realtime menggunakan Socket.IO.
- Conversation memiliki unread counter per member menggunakan `last_read_at`.

## Arsitektur

Project menggunakan modular monolith architecture. Seluruh modul berjalan dalam satu aplikasi Node.js, tetapi setiap domain memiliki controller, schema, route, dan middleware yang terpisah.

```text
Client / Frontend
       |
       | REST API
       v
Express Application
       |
       +-- Authentication Middleware
       +-- Conversation Membership Middleware
       +-- Module Controllers
       +-- Validation Utilities
       |
       +-- Sequelize / Raw SQL
       |       |
       |       v
       |   PostgreSQL
       |
       +-- Socket.IO
               |
               +-- conversation:join
               +-- conversation:leave
               +-- message:new
               +-- conversation:updated
               +-- conversation:deleted
```

### Request flow

```text
Request
  -> JWT Authentication
  -> Resolve authenticated user
  -> Validate conversation membership
  -> Validate request body
  -> Execute database operation
  -> Return API response
  -> Broadcast Socket.IO event when required
```

### Modul utama

| Modul | Tanggung jawab |
| --- | --- |
| Auth | Register, login, logout, dan current user |
| User | User listing dan user data |
| Conversation | Create, list, delete, opponent, last message, unread count |
| Message | Create dan mengambil encrypted messages dengan cursor pagination |
| Socket | Authentication koneksi realtime, room membership, dan event broadcast |

## Teknologi

| Teknologi | Kegunaan |
| --- | --- |
| Node.js | Runtime JavaScript server-side |
| Express 5 | HTTP server dan routing |
| PostgreSQL | Relational database utama |
| Sequelize 6 | Database connection, models, migrations, dan raw query interface |
| Sequelize CLI | Menjalankan migration dan seeder |
| Zod | Validasi request body dan parameter |
| JSON Web Token | Authentication dan identity pada request |
| Argon2id | Password hashing |
| Socket.IO | Komunikasi realtime dan room-based broadcast |
| Helmet | HTTP security headers |
| CORS | Pengaturan akses dari frontend |
| Morgan | HTTP request logging |
| dotenv | Environment variable loader |

## Struktur Project

```text
.
├── index.js                         # Application entry point dan HTTP server
├── package.json
├── .env.example
├── config/
│   └── config.js                    # Database configuration
├── db/
│   ├── models/                      # Sequelize models
│   ├── migrations/                  # Database schema migrations
│   └── seeders/                     # Demo data seeders
└── src/
    ├── routes.js                    # Root API routes
    ├── middleware/
    │   ├── authMiddleware.js        # JWT authentication
    │   └── conversationMiddleware.js# Conversation membership check
    ├── modules/
    │   ├── auth/
    │   ├── user/
    │   ├── conversation/
    │   └── message/
    └── utils/
        ├── api.js                   # Standard API response
        ├── validation.js            # Shared Zod validation helper
        ├── bcrypt.js                # Argon2id hash and verify wrapper
        └── socket.js                # Socket.IO initialization and events
```

## Persiapan

Prerequisites:

- Node.js 18 atau lebih baru
- npm
- PostgreSQL 13 atau lebih baru
- Database PostgreSQL yang dapat diakses oleh aplikasi

Install dependency:

```bash
npm install
```

## Konfigurasi Environment

Buat file `.env` berdasarkan `.env.example`:

```bash
cp .env.example .env
```

Pada Windows PowerShell:

```powershell
Copy-Item .env.example .env
```

Contoh konfigurasi:

```env
NODE_ENV=development
PORT=8001

JWT_KEY=replace_with_a_long_random_secret
JWT_EXP=1d

DB_USER=postgres
DB_PASS=postgres
DB_NAME=akselera_chat
DB_HOST=127.0.0.1
DB_PORT=5432
DB_CONNECTION=postgresql
DB_SSL=false

ALLOWED_ORIGINS=http://localhost:3000
```

`JWT_KEY` wajib memiliki nilai. Jangan commit file `.env` atau secret ke repository.

## Database

Migration utama membuat tabel berikut:

### users

Menyimpan identity user, email, Argon2id password hash, public key, encrypted private key, dan key derivation salt. Kolom `last_seen_at` diisi saat user terputus dari Socket.IO dan digunakan untuk menampilkan status terakhir dilihat.

### conversations

Menyimpan identity dan timestamp conversation.

### conversation_members

Menghubungkan user dengan conversation. Kolom `last_read_at` digunakan untuk menghitung unread message per user.

### messages

Menyimpan encrypted message payload:

| Kolom | Keterangan |
| --- | --- |
| `id` | UUID message |
| `conversation_id` | Conversation pemilik message |
| `sender_id` | User yang mengirim, berasal dari JWT |
| `ciphertext` | Encrypted message |
| `iv` | AES-GCM initialization vector |
| `auth_tag` | AES-GCM authentication tag |
| `created_at` | Waktu message dibuat |

Tidak ada kolom `content` atau plaintext message pada database.

Jalankan migration:

```bash
npm run migrate
```

Jalankan demo seeder jika diperlukan:

```bash
npm run seed
```

## Menjalankan Project

Development mode:

```bash
npm run dev
```

Production mode:

```bash
npm start
```

Health check:

```http
GET /api/v1/health
```

Default server URL:

```text
http://localhost:8001
```

## API Endpoint

Semua endpoint API menggunakan prefix `/api/v1`.

### Authentication

#### Register

```http
POST /api/v1/auth/register
```

Body:

```json
{
  "name": "Rayhan",
  "email": "rayhan@example.com",
  "password": "strong-password",
  "public_key": "client-public-key",
  "encrypted_private_key": "encrypted-private-key",
  "key_derivation_salt": "client-key-salt"
}
```

Password di-hash dengan Argon2id sebelum disimpan.

#### Login

```http
POST /api/v1/auth/login
```

Body:

```json
{
  "email": "rayhan@example.com",
  "password": "strong-password"
}
```

Login membuat JWT dan mengirimkannya sebagai HTTP-only cookie `token`.

#### Current user dan logout

```http
GET /api/v1/auth/get-me
POST /api/v1/auth/logout
```

### Users

```http
GET /api/v1/users
```

Setiap user menyertakan status online:

```json
{
  "id": "user-uuid",
  "name": "Dimas",
  "email": "dimas@example.com",
  "last_seen_at": "2026-09-26T12:07:30.673Z",
  "is_online": false
}
```

`last_seen_at` bernilai `null` ketika user sedang online atau belum pernah terlihat. Gunakan `is_online` sebagai penentu utama.

### Conversations

Semua endpoint conversation membutuhkan authentication.

#### List conversations

```http
GET /api/v1/conversations?page=1&per_page=10
```

Response menyediakan opponent, last message, dan unread counter:

```json
{
  "success": true,
  "message": "Conversations retrieved successfully",
  "metadata": {
    "per_page": 10,
    "current_page": 1,
    "total_row": 2,
    "total_page": 1
  },
  "data": [
    {
      "id": "conversation-uuid",
      "created_at": "2026-09-26T12:07:30.673Z",
      "opponent": {
        "id": "user-uuid",
        "name": "Dimas",
        "email": "dimas@example.com",
        "public_key": "client-public-key",
        "is_online": true,
        "last_seen_at": null
      },
      "last_message": null,
      "unread_count": 0
    }
  ]
}
```

Conversation diurutkan berdasarkan message terakhir. Conversation tanpa message berada setelah conversation yang memiliki message. Nilai `is_online` dan `last_seen_at` pada `opponent` mengikuti aturan yang sama dengan endpoint users.

#### Create conversation

```http
POST /api/v1/conversations
```

Body hanya membutuhkan satu email member lain:

```json
{
  "member_email": "dimas@example.com"
}
```

User yang login otomatis menjadi member pertama. Conversation yang sama tidak dibuat ulang.

#### Mark conversation as read

```http
PATCH /api/v1/conversations/:conversationId/read
```

Endpoint ini mengubah `last_read_at` untuk user yang sedang login dan mengembalikan `unread_count: 0`.

#### Delete conversation

```http
DELETE /api/v1/conversations/:conversationId
```

Hanya member conversation yang dapat menghapusnya. Penghapusan bersifat permanen dan message terkait ikut terhapus melalui cascade foreign key.

### Messages

#### Send encrypted message

```http
POST /api/v1/conversations/:conversationId/messages
```

Body:

```json
{
  "ciphertext": "encrypted-message",
  "iv": "base64-iv",
  "auth_tag": "base64-auth-tag"
}
```

`sender_id` tidak diterima dari body. Nilainya selalu diambil dari user yang sudah diverifikasi JWT.

#### Get messages

```http
GET /api/v1/conversations/:conversationId/messages?limit=30
```

Pagination menggunakan cursor:

```http
GET /api/v1/conversations/:conversationId/messages?limit=30&before=<cursor>
```

Message diurutkan secara kronologis menggunakan `created_at` dan `id` sebagai tie-breaker.

## Realtime dengan Socket.IO

Socket.IO menggunakan HTTP server yang sama dengan REST API.

### Connection

```javascript
import { io } from 'socket.io-client'

const socket = io('http://localhost:8001', {
  auth: {
    token: jwtToken
  }
})
```

Socket juga mendukung JWT dari cookie `token`.

### Join conversation

```javascript
socket.emit('conversation:join', conversationId, (response) => {
  console.log(response)
})
```

Server memverifikasi membership sebelum client masuk room conversation.

### Event realtime

```javascript
socket.on('message:new', (message) => {
  // Message masih terenkripsi.
})

socket.on('conversation:updated', (data) => {
  // Update last_message dan unread_count, lalu pindahkan conversation ke posisi teratas.
})

socket.on('conversation:deleted', ({ conversation_id }) => {
  // Hapus conversation dari local state.
})
```

Payload utama `conversation:updated`:

```json
{
  "conversation_id": "conversation-uuid",
  "last_message": {
    "id": "message-uuid",
    "sender_id": "sender-uuid",
    "ciphertext": "...",
    "iv": "...",
    "auth_tag": "...",
    "created_at": "..."
  },
  "updated_at": "...",
  "unread_count": 1
}
```

### Online status

Server melacak koneksi socket per user. User dianggap online selama minimal satu socket masih terhubung, sehingga membuka beberapa tab atau device tidak membuat status berkedip offline.

Tiga event yang tersedia:

```javascript
// Dikirim ke socket yang baru terhubung, berisi status seluruh lawan bicara.
socket.on('presence:sync', ({ presence }) => {
  // presence: [{ user_id, is_online, last_seen_at }]
})

// Dikirim saat lawan bicara online atau offline.
socket.on('presence:update', ({ user_id, is_online, last_seen_at }) => {
  // Perbarui indicator pada conversation terkait.
})

// Menanyakan status user tertentu secara langsung.
socket.emit('presence:get', [userId1, userId2], (response) => {
  // { success: true, presence: [{ user_id, is_online, last_seen_at }] }
})
```

Permintaan `presence:get` menerima 1 sampai 100 user ID. User yang tidak dikenal atau sudah dihapus tetap dikembalikan dengan `is_online: false` dan `last_seen_at: null`.

`last_seen_at` berisi waktu koneksi terakhir dan bernilai `null` selama user online atau belum pernah terlihat. Client sebaiknya memeriksa `is_online` terlebih dahulu, lalu menampilkan `last_seen_at` hanya ketika user offline.

Perubahan status hanya disebarkan kepada user yang memiliki conversation bersama, bukan ke seluruh client.

### Room design

```text
conversation:<conversationId>  # message:new
user:<userId>                   # conversation:updated, conversation:deleted, dan presence:update
```

## Security

- Password menggunakan Argon2id, bukan reversible encryption.
- JWT diverifikasi pada setiap REST request yang terproteksi.
- Socket.IO juga memverifikasi JWT pada handshake.
- User hanya dapat membaca atau mengirim message jika menjadi member conversation.
- `sender_id` tidak boleh dipalsukan melalui request body.
- Message plaintext tidak diproses atau didekripsi backend.
- Response user tidak mengekspos `password_hash` atau private key.
- Status online hanya disebarkan kepada member conversation yang sama, bukan ke seluruh client.
- Query database menggunakan parameterized replacements untuk mengurangi risiko SQL injection.
- Secret dan credential hanya berasal dari environment variable.
- Helmet dan CORS digunakan sebagai lapisan security HTTP.

## Format Response

Response API menggunakan format terpusat:

```json
{
  "success": true,
  "message": "success",
  "metadata": {},
  "data": {}
}
```

Contoh error:

```json
{
  "success": false,
  "message": "You are not a member of this conversation",
  "metadata": {},
  "data": null
}
```

HTTP status yang digunakan:

| Status | Keterangan |
| --- | --- |
| `200` | Request berhasil |
| `201` | Resource berhasil dibuat |
| `400` | Request atau validation tidak valid |
| `401` | JWT tidak ada atau invalid |
| `403` | User bukan member conversation |
| `404` | Conversation tidak ditemukan |
| `500` | Unexpected server error |

## Testing Flow

Urutan pengujian melalui Postman atau frontend:

1. Jalankan PostgreSQL dan isi `.env`.
2. Jalankan `npm run migrate`.
3. Jalankan server dengan `npm run dev`.
4. Register atau login User A.
5. Register atau login User B.
6. User A membuat conversation menggunakan `member_email` User B.
7. User A dan User B membuka Socket.IO connection.
8. Keduanya join room conversation.
9. User A mengirim encrypted message melalui REST.
10. User B menerima event `message:new` dan `conversation:updated`.
11. User B memanggil endpoint `PATCH /read` saat conversation dibuka.
12. Pastikan `unread_count` User B kembali menjadi `0`.
13. User C yang bukan member harus menerima `403` saat mengakses message.
14. User yang logout lalu login kembali tetap dapat mengambil message dari database.

## Troubleshooting

### `secretOrPrivateKey must have a value`

Pastikan `.env` memiliki secret:

```env
JWT_KEY=replace_with_a_long_random_secret
```

Restart server setelah mengubah `.env`.

### Database connection failed

Periksa:

- PostgreSQL sedang berjalan.
- `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASS`, dan `DB_NAME` benar.
- `DB_CONNECTION=postgresql`.
- Database sudah dibuat.
- Migration sudah dijalankan.

### Socket authentication failed

Pastikan client mengirim JWT pada `auth.token` atau cookie `token`, dan secret yang digunakan sama dengan `JWT_KEY` backend.

## Scripts

| Command | Keterangan |
| --- | --- |
| `npm run dev` | Menjalankan development server dengan Nodemon |
| `npm start` | Menjalankan server |
| `npm run migrate` | Menjalankan seluruh migration |
| `npm run migrate:undo` | Rollback migration terakhir |
| `npm run migrate:undo:all` | Rollback seluruh migration |
| `npm run seed` | Menjalankan seluruh seeder |
| `npm run seed:undo` | Menghapus data seeder |
| `npm run make:full` | Membuat model dan migration melalui Sequelize CLI |

## Catatan Pengembangan

Backend sengaja tidak melakukan dekripsi message. Kunci enkripsi tetap berada di client dan tidak dikirim ke server. Dengan pendekatan ini, database hanya menyimpan encrypted payload sehingga backend tidak memiliki akses ke plaintext message.

Status online disimpan di memory proses (`src/utils/presence.js`), sehingga pelacakan koneksi hanya akurat untuk satu instance. Jika backend dijalankan di beberapa instance sekaligus, diperlukan shared store seperti Redis beserta adapter Socket.IO. Registry koneksi sengaja dipisahkan pada modul tersendiri agar dapat diganti tanpa mengubah `src/utils/socket.js` atau controller.

`last_seen_at` hanya diperbarui pada disconnect yang bersih. Jika proses berhenti paksa (crash atau `SIGKILL`), timestamp terakhir tidak ikut diperbarui.

Untuk production, disarankan menambahkan automated tests, rate limiting pada authentication, centralized error middleware, structured logging, secret rotation, dan observability untuk Socket.IO.

## License

Project ini dibuat untuk kebutuhan assignment dan pengembangan internal Akselera.Tech.
