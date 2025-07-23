require('dotenv').config() 

const authenticateToken = require('./middleware/auth')
const jwt = require('jsonwebtoken')
const bcrypt = require('bcrypt')
const express = require('express')
const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()
const app = express()
app.use(express.json())

app.post('/signup', async (req, res) => {
  const { email, password } = req.body

  try {
    const existingUser = await prisma.user.findUnique({ where: { email } })
    if (existingUser) {
      return res.status(400).json({ error: 'Email already in use' })
    }

    const hashedPassword = await bcrypt.hash(password, 10)

    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
      },
    })

    res.status(201).json({ id: user.id, email: user.email })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

app.post('/login', async (req, res) => {
  const { email, password } = req.body

  try {
    const user = await prisma.user.findUnique({ where: { email } })
    if (!user) return res.status(401).json({ error: 'Email ou senha inválidos' })

    const isValid = await bcrypt.compare(password, user.password)
    if (!isValid) return res.status(401).json({ error: 'Email ou senha inválidos' })

    const token = jwt.sign(
      { userId: user.id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    )

    res.json({ token }) 
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})



app.post('/tracks', authenticateToken, async (req, res) => {
  try {
    const track = await prisma.track.create({ data: req.body })
    res.status(201).json(track)
  } catch (error) {
    res.status(400).json({ error: error.message })
  }
})

app.get('/tracks', authenticateToken, async (req, res) => {
  try {
    const tracks = await prisma.track.findMany()
    res.json(tracks)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

app.put('/tracks/:id', authenticateToken, async (req, res) => {
  const trackId = Number(req.params.id)
  const data = req.body

  try {
    const updatedTrack = await prisma.track.update({
      where: {id: trackId},
      data
    })
    res.json(updatedTrack)
    
  } catch (error) {
    res.status(400).json({ error: error.message })
  }
})

app.delete('/tracks/:id', authenticateToken, async (req, res) => {
  const trackId = Number(req.params.id)

  try {
    await prisma.track.delete({
      where: {id: trackId}
    })
    res.status(204).send()
  } catch (error) {
    res.status(400).json({ error: error.message })
  }
})

const PORT = process.env.PORT || 3000
app.listen(PORT, () => console.log(`Server running on port ${PORT}`))
