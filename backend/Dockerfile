FROM python:3.12-slim

# Install system dependencies for OpenCV and dlib (face-recognition)
RUN apt-get update && apt-get install -y \
    cmake \
    libgl1-mesa-glx \
    libglib2.0-0 \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy requirements and install
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy the rest of the backend code
COPY . .

EXPOSE 8000

# Run migrations and start the server
CMD ["sh", "-c", "python manage.py migrate --noinput && daphne -b 0.0.0.0 -p 8000 backend.asgi:application"]
