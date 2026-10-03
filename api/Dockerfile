FROM python:3.12-slim

# Non-root user
RUN useradd --create-home --shell /bin/bash waypoint

WORKDIR /app

# Install deps first (better layer caching)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code and entrypoint
COPY . .
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

# Create upload directory
RUN mkdir -p /uploads && chown waypoint:waypoint /uploads

USER waypoint

ENTRYPOINT ["/entrypoint.sh"]
