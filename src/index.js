require('dotenv').config() 

const express = require('express')
const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()
const app = express()
app.use(express.json())

app.post('/tracks', async (req, res) => {
  try {
    const track = await prisma.track.create({ data: req.body })
    res.status(201).json(track)
  } catch (error) {
    res.status(400).json({ error: error.message })
  }
})

app.get('/tracks', async (req, res) => {
  try {
    const tracks = await prisma.track.findMany()
    res.json(tracks)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

app.put('/tracks/:id', async (req, res) => {
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

app.delete('/tracks/:id', async (req, res) => {
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
