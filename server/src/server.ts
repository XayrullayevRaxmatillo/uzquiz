import http from 'node:http'
import mongoose from 'mongoose'
import { env } from './config/env.js'
import { createApp } from './app.js'
import { createSocketServer } from './sockets/index.js'
import { GameEngine } from './sockets/engine.js'

async function main() {
  mongoose.set('strictQuery', true)
  try {
    await mongoose.connect(env.MONGODB_URI, { serverSelectionTimeoutMS: 10_000 })
  } catch {
    console.error('\nCould not connect to MongoDB (the connection string is not printed).')
    console.error('Set MONGODB_URI in server/.env to your MongoDB Atlas string (see README, section 2),')
    console.error('or start a local MongoDB on 127.0.0.1:27017.\n')
    process.exit(1)
  }
  console.log('MongoDB connected')
  await GameEngine.closeOrphanedRooms() // games running when the previous process died cannot be resumed

  const app = createApp()
  const server = http.createServer(app)
  const { io, engine } = createSocketServer(server)
  server.listen(env.PORT, () => console.log(`UZQUIZ API listening on :${env.PORT}`))

  const shutdown = async () => {
    engine.stop()
    io.close()
    server.close()
    await mongoose.disconnect()
    process.exit(0)
  }
  process.on('SIGINT', shutdown)
  process.on('SIGTERM', shutdown)
}

main().catch((e) => {
  console.error('Fatal startup error:', e instanceof Error ? e.message : e)
  process.exit(1)
})
