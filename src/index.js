import dotenv from 'dotenv';
dotenv.config();

import { promisify } from 'util';
import { exec as execCb } from 'child_process';
import fs from 'fs';
import path from 'path';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import express from 'express';
import { PrismaClient } from '@prisma/client';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'; 

import authenticateToken from './middleware/auth.js';

const exec = promisify(execCb);
const prisma = new PrismaClient();
const app = express();
const s3 = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
  }
});

app.use(express.json())

const execAsync = promisify(exec);

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
  const { url } = req.body;
  const userId = req.user.userId;

  if (!url) return res.status(400).json({ error: 'url is required' });

  try {
    const downloadFolder = path.join(process.cwd(), 'downloads');

    if (!fs.existsSync(downloadFolder)) fs.mkdirSync(downloadFolder);

    // Extrai metadata test
    const { stdout: metadataRaw } = await exec(`yt-dlp --dump-json "${url}"`);
    const metadata = JSON.parse(metadataRaw);

    const filename = `${metadata.title}-${Date.now()}.mp3`;
    const outputPath = path.join(downloadFolder, filename);

    // Baixa áudio
    await exec(`yt-dlp -x --audio-format mp3 -o "${outputPath}" "${url}"`);

    // Upload para S3 via stream
    const fileStream = fs.createReadStream(outputPath);
    const s3Key = `tracks/${filename}`;

    const uploadParams = {
      Bucket: process.env.AWS_BUCKET_NAME,
      Key: s3Key,
      Body: fileStream,
      ContentType: 'audio/mpeg'
    };

    await s3.send(new PutObjectCommand(uploadParams));

    // Remove arquivo local
    fs.unlinkSync(outputPath);

    const s3Url = `https://${process.env.AWS_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${s3Key}`;

    // Salva no banco
    const track = await prisma.track.create({
      data: {
        url,
        userId,
        filename,
        s3Url,
        title: metadata.title || null,
        artist: metadata.uploader || null,
        duration: metadata.duration || null,
        thumbnail: metadata.thumbnail || null,
      }
    });

    res.status(201).json(track);

  } catch (error) {
    console.error(error);
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
