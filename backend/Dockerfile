FROM python:3.10-slim

# Install system dependencies required by OpenCV and audio libraries
RUN apt-get update && apt-get install -y \
    libgl1-mesa-glx \
    libglib2.0-0 \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy requirements and install
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application files
COPY . .

# Expose port (Render/HF sets the PORT environment variable, defaults to 7860)
EXPOSE 7860

# Start server using uvicorn directly
# Render/HF will pass the dynamic PORT env var
CMD ["sh", "-c", "uvicorn app:app --host 0.0.0.0 --port ${PORT:-7860}"]
