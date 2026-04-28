FROM ubuntu:22.04

# Prevent interactive prompts during apt-get
ENV DEBIAN_FRONTEND=noninteractive
ENV PYTHONUNBUFFERED=1

# Install python, pip, and PRE-COMPILED dlib (bypasses all compile errors!)
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    python3-dlib \
    libgl1-mesa-glx \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .

# Install the rest of the python requirements
# Since python3-dlib is already installed by apt, pip will completely skip building dlib!
RUN pip3 install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8000

CMD ["sh", "-c", "python3 manage.py migrate --noinput && daphne -b 0.0.0.0 -p 8000 backend.asgi:application"]
