#!/bin/bash

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

echo "🚀 Qdrant Setup Wizard"
echo "====================="
echo ""

# Function to check if Docker is running
check_docker() {
    if ! docker info >/dev/null 2>&1; then
        echo "❌ Docker is not running. Please start Docker first."
        exit 1
    fi
}

# Function to check if port is in use
check_port() {
    local port=$1
    if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null 2>&1; then
        return 1
    else
        return 0
    fi
}

# Function to setup local Qdrant
setup_local_qdrant() {
    echo "Setting up local Qdrant with Docker..."
    echo ""

    check_docker

    # Check if Qdrant is already running
    if docker ps --format '{{.Names}}' | grep -q '^rag-qdrant$'; then
        echo "✅ Qdrant is already running"
        echo ""
        echo "Qdrant Dashboard: http://localhost:6333/dashboard"
        echo "API Endpoint: http://localhost:6333"
        return 0
    fi

    # Check if container exists but is stopped
    if docker ps -a --format '{{.Names}}' | grep -q '^rag-qdrant$'; then
        echo "🔄 Starting existing Qdrant container..."
        docker start rag-qdrant
        echo "✅ Qdrant started"
        echo ""
        echo "Qdrant Dashboard: http://localhost:6333/dashboard"
        echo "API Endpoint: http://localhost:6333"
        return 0
    fi

    # Check port availability
    if ! check_port 6333; then
        echo "⚠️  Port 6333 is already in use"
        echo "Would you like to:"
        echo "1) Stop the service using port 6333"
        echo "2) Use a different port"
        echo "3) Exit"
        read -p "Choice (1-3): " port_choice

        case $port_choice in
            1)
                echo "Stopping service on port 6333..."
                lsof -ti:6333 | xargs kill -9 2>/dev/null || true
                ;;
            2)
                read -p "Enter alternative port: " alt_port
                QDRANT_PORT=$alt_port
                ;;
            3)
                exit 0
                ;;
        esac
    fi

    QDRANT_PORT=${QDRANT_PORT:-6333}

    # Choose setup method
    echo "Choose setup method:"
    echo "1) Docker Compose (recommended)"
    echo "2) Standalone Docker container"
    read -p "Choice (1-2): " setup_method

    case $setup_method in
        1)
            cd "$PROJECT_ROOT"
            echo "🐳 Starting Qdrant with Docker Compose..."
            docker-compose up -d qdrant
            echo ""
            echo "✅ Qdrant started"
            echo "Qdrant Dashboard: http://localhost:6333/dashboard"
            ;;
        2)
            echo "🐳 Starting Qdrant as standalone container..."
            docker run -d \
                --name rag-qdrant \
                -p ${QDRANT_PORT}:6333 \
                -v "${PROJECT_ROOT}/qdrant_storage:/qdrant/storage:z" \
                --restart unless-stopped \
                qdrant/qdrant

            echo ""
            echo "✅ Qdrant started"
            echo "Qdrant Dashboard: http://localhost:${QDRANT_PORT}/dashboard"
            ;;
    esac

    # Update .env file
    update_env_local $QDRANT_PORT

    echo "API Endpoint: http://localhost:${QDRANT_PORT}"
    echo ""

    # Wait for Qdrant to be ready
    echo "⏳ Waiting for Qdrant to be ready..."
    for i in {1..30}; do
        if curl -s "http://localhost:${QDRANT_PORT}/readyz" >/dev/null 2>&1; then
            echo "✅ Qdrant is ready!"
            return 0
        fi
        sleep 1
        echo -n "."
    done

    echo ""
    echo "⚠️  Qdrant is taking longer than expected to start"
    echo "Check Docker logs: docker logs rag-qdrant"
}

# Function to setup Qdrant Cloud
setup_cloud_qdrant() {
    echo "Setting up Qdrant Cloud..."
    echo ""
    echo "📝 To use Qdrant Cloud, you need:"
    echo "1. A Qdrant Cloud account (https://cloud.qdrant.io)"
    echo "2. A cluster URL"
    echo "3. An API key"
    echo ""

    read -p "Enter your Qdrant Cloud URL (e.g., https://xyz.qdrant.io): " cloud_url
    read -p "Enter your Qdrant API key: " -s api_key
    echo ""

    # Test connection
    echo "🔍 Testing connection..."
    if curl -s -H "api-key: $api_key" "${cloud_url}/collections" >/dev/null 2>&1; then
        echo "✅ Successfully connected to Qdrant Cloud!"

        # Update .env file
        update_env_cloud "$cloud_url" "$api_key"

        echo ""
        echo "Configuration saved to .env file"
    else
        echo "❌ Failed to connect to Qdrant Cloud"
        echo "Please check your URL and API key"
        exit 1
    fi
}

# Function to update .env for local setup
update_env_local() {
    local port=$1
    cd "$PROJECT_ROOT"

    if [ -f .env ]; then
        # Comment out cloud settings, uncomment local
        sed -i.bak \
            -e "s|^QDRANT_URL=https://.*|# &|" \
            -e "s|^QDRANT_API_KEY=.*|# &|" \
            -e "s|^# *QDRANT_URL=http://localhost:.*|QDRANT_URL=http://localhost:${port}|" \
            -e "s|^QDRANT_URL=.*|QDRANT_URL=http://localhost:${port}|" \
            .env

        # If QDRANT_URL doesn't exist, add it
        if ! grep -q "^QDRANT_URL=" .env; then
            echo "" >> .env
            echo "# Vector Database - Local Qdrant" >> .env
            echo "QDRANT_URL=http://localhost:${port}" >> .env
        fi
    else
        echo "⚠️  No .env file found. Creating one..."
        cp .env.example .env 2>/dev/null || echo "QDRANT_URL=http://localhost:${port}" > .env
    fi
}

# Function to update .env for cloud setup
update_env_cloud() {
    local url=$1
    local key=$2
    cd "$PROJECT_ROOT"

    if [ -f .env ]; then
        # Update or add Qdrant settings
        if grep -q "^QDRANT_URL=" .env; then
            sed -i.bak "s|^QDRANT_URL=.*|QDRANT_URL=${url}|" .env
        else
            echo "QDRANT_URL=${url}" >> .env
        fi

        if grep -q "^QDRANT_API_KEY=" .env; then
            sed -i.bak "s|^QDRANT_API_KEY=.*|QDRANT_API_KEY=${key}|" .env
        else
            echo "QDRANT_API_KEY=${key}" >> .env
        fi
    else
        echo "⚠️  No .env file found. Creating one..."
        cat > .env << EOF
# Vector Database - Qdrant Cloud
QDRANT_URL=${url}
QDRANT_API_KEY=${key}
EOF
    fi
}

# Main menu
echo "Choose your Qdrant setup:"
echo "1) Local Qdrant (Docker)"
echo "2) Qdrant Cloud"
echo "3) Check existing setup"
echo "4) Stop local Qdrant"
echo "5) Exit"
echo ""
read -p "Enter your choice (1-5): " choice

case $choice in
    1)
        setup_local_qdrant
        ;;
    2)
        setup_cloud_qdrant
        ;;
    3)
        echo "Checking Qdrant setup..."
        if docker ps --format '{{.Names}}' | grep -q '^rag-qdrant$'; then
            echo "✅ Local Qdrant is running"
            echo "Dashboard: http://localhost:6333/dashboard"
        else
            echo "❌ Local Qdrant is not running"
        fi

        if [ -f "$PROJECT_ROOT/.env" ]; then
            source "$PROJECT_ROOT/.env"
            if [[ $QDRANT_URL == *"qdrant.io"* ]]; then
                echo "📍 Configured for Qdrant Cloud: $QDRANT_URL"
            elif [[ $QDRANT_URL == *"localhost"* ]]; then
                echo "📍 Configured for local Qdrant: $QDRANT_URL"
            fi
        fi
        ;;
    4)
        echo "Stopping local Qdrant..."
        docker stop rag-qdrant 2>/dev/null || echo "Qdrant container not running"
        echo "✅ Done"
        ;;
    5)
        exit 0
        ;;
    *)
        echo "Invalid choice"
        exit 1
        ;;
esac

echo ""
echo "🎯 Next steps:"
echo "1. Ensure your .env file has the correct API keys"
echo "2. Run: npm run ingest:files (to ingest documents)"
echo "3. Run: npm run dev (to start the server)"
echo "4. Visit: http://localhost:3000"