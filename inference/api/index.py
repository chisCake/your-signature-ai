"""
Vercel serverless function entry point for FastAPI application
"""
import sys
import os

# Добавляем родительскую директорию в путь для импорта main
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from mangum import Mangum
from main import app

# Обертка для FastAPI приложения для работы на Vercel
handler = Mangum(app, lifespan="off")

