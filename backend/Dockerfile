FROM python:3.11-slim

WORKDIR /app

# Install system dependencies for psycopg2
RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq-dev gcc \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements first for Docker layer caching
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy the rest of the application
COPY . .

# Create uploads directory
RUN mkdir -p /app/uploads

# Expose port (Render injects $PORT at runtime)
EXPOSE 8000

# Make startup script executable
RUN chmod +x start.sh

# Start command — runs migrations then uvicorn
CMD ["./start.sh"]
