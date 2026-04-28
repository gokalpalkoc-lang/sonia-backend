FROM python:3.10-slim

WORKDIR /app

# Install system dependencies for OpenCV and compiling dlib
RUN apt-get update && apt-get install -y \
    cmake \
    libgl1-mesa-glx \
    libglib2.0-0 \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Copy root requirements
COPY requirements.txt .

# Install python requirements
# dlib will compile successfully here because Python 3.10 has distutils!
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend source
COPY backend/ .

EXPOSE 8000

# Run migrations and start Daphne
CMD ["sh", "-c", "python manage.py migrate --noinput && daphne -b 0.0.0.0 -p 8000 backend.asgi:application"]