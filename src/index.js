require('dotenv').config() 

const { exec } = require('child_process')
const fs = require('fs')
const authenticateToken = require('./middleware/auth')
const jwt = require('jsonwebtoken')
const bcrypt = require('bcrypt')
const express = require('express')
const { PrismaClient } = require('@prisma/client')
const path = require('path')
const prisma = new PrismaClient()
const app = express()

app.use('/downloads', express.static(path.join(__dirname, '..', 'downloads')))
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
  const { url, userId } = req.body;

  if (!url || !userId) {
    return res.status(400).json({ error: 'url and userId are required' });
  }

  try {
    const downloadFolder = path.join(__dirname, '..', 'downloads');

    if (!fs.existsSync(downloadFolder)) {
      fs.mkdirSync(downloadFolder);
    }

    const filename = `track-${Date.now()}.mp3`;
    const outputPath = path.join(downloadFolder, filename);

    exec(`yt-dlp --dump-json "${url}"`, async (error, stdout) => {
      if (error) {
        console.error('Erro ao extrair metadata:', error);
        return res.status(500).json({ error: 'Failed to extract metadata' });
      }

      const metadata = JSON.parse(stdout);

      const title = metadata.title || null;
      const artist = metadata.uploader || null;
      const duration = metadata.duration || null;
      const thumbnail = metadata.thumbnail || null;

      // Agora fazer o download
      const cmd = `yt-dlp -x --audio-format mp3 -o "${outputPath}" "${url}"`;
      exec(cmd, async (dlError) => {
        if (dlError) {
          console.error('Erro ao baixar com yt-dlp:', dlError);
          return res.status(500).json({ error: 'Failed to download audio' });
        }

        const track = await prisma.track.create({
          data: {
            url,
            userId,
            filename,
            title,
            artist,
            duration,
            thumbnail
          }
        });

        res.status(201).json(track);
      });
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});


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
