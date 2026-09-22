# Open-Source Telugu Voice AI Lab: Self-Hosted & Local Deployment Guide

## 1. Overview & Objectives
The **Open-Source Telugu Voice Lab** provides an API-free, self-hosted Telugu speech synthesis and real-time conversational receptionist engine. It operates completely independently of commercial voice APIs (Sarvam, ElevenLabs, Google TTS, Murf).

### Supported Open-Source Models:
1. **AI4Bharat IndicF5** (`ai4bharat/IndicF5`)
   - Architecture: Flow-matching Diffusion Transformer
   - Features: High-fidelity natural Telugu speech, custom reference voice cloning with prosody preservation.
   - License: MIT License (Commercial use permitted).
2. **AI4Bharat Indic Parler-TTS** (`ai4bharat/indic-parler-tts`)
   - Architecture: Autoregressive Parler Architecture
   - Speakers: **Lalitha** (Female), **Prakash** (Male), **Kiran** (Male).
   - Natural Language Conditioning: Specially tuned prompts for conversational receptionist turn-taking with realistic pauses.
   - License: Apache 2.0 (Commercial use permitted).
3. **Pocket TTS Telugu** (`prasadvittaldev/pocket-tts-telugu-female-syspin`)
   - Architecture: Lightweight CPU VITS
   - Speaker: **Syspin Female** (24 kHz)
   - Features: Real-time sub-second inference on standard multi-core CPUs.
   - License: CC-BY-4.0.

---

## 2. Hardware Requirements & Acceleration

| Mode | Minimum Spec | Recommended Spec | Target Models |
| :--- | :--- | :--- | :--- |
| **Real-Time (CPU)** | 4 Cores CPU, 4 GB RAM | 8 Cores CPU, 8 GB RAM | Pocket TTS Telugu |
| **Balanced (CPU/GPU)**| 8 Cores CPU, 8 GB RAM | NVIDIA RTX 3060 / T4, 16 GB RAM | Indic Parler-TTS |
| **Quality (CUDA GPU)**| NVIDIA RTX 3080 / A10G (8GB VRAM)| NVIDIA A100 / L4 (16GB+ VRAM) | IndicF5 & Parler-TTS |

---

## 3. Docker Deployment

### Run with NVIDIA CUDA Acceleration:
```bash
docker compose -f docker-compose.open-source-tts.yml up -d --build
```

### Run on Standard CPU (No GPU Required):
```bash
docker run -d \
  --name open-source-voice-lab \
  -p 3000:3000 \
  -e OFFLINE_MODE=true \
  -e CUDA_VISIBLE_DEVICES=-1 \
  -v $(pwd)/pronunciation_dictionary.json:/app/pronunciation_dictionary.json \
  open-source-voice-lab
```

---

## 4. REST API Reference

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/v1/voice/open-source/status` | Read CPU, RAM, GPU, VRAM, and CUDA hardware detection |
| `GET` | `/api/v1/voice/open-source/models` | List all available open-source models with memory requirements |
| `GET` | `/api/v1/voice/open-source/voices` | List native Telugu voice profiles |
| `POST` | `/api/v1/voice/open-source/load` | Load a model onto target device (`cuda` or `cpu`) |
| `POST` | `/api/v1/voice/open-source/unload` | Unload a model to free VRAM/RAM |
| `POST` | `/api/v1/voice/open-source/synthesize` | Generate natural Telugu speech from text |
| `POST` | `/api/v1/voice/open-source/benchmark` | Record benchmark test scores (TTFA, RTF, human ratings) |
| `GET` | `/api/v1/voice/open-source/dictionary` | Fetch custom pronunciation rules (`pronunciation_dictionary.json`) |
| `POST` | `/api/v1/voice/open-source/dictionary` | Add or update custom pronunciation rule |
| `POST` | `/api/v1/voice/open-source/realtime-chat` | Duplex conversational turn with VAD and Barge-In support |
| `POST` | `/api/v1/voice/open-source/set-receptionist-voice` | Assign an open-source voice as the active receptionist voice |
