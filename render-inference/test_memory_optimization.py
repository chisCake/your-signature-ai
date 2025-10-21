#!/usr/bin/env python3
"""
Тестовый скрипт для проверки оптимизаций памяти
"""

import os
import sys
import time
import requests
import json
from typing import Dict, Any

# Добавляем путь к модулям
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

def test_memory_optimizations(base_url: str = "http://localhost:8000") -> None:
    """Тестирование оптимизаций памяти"""
    
    print("🧪 Тестирование оптимизаций памяти...")
    print(f"📡 Базовый URL: {base_url}")
    
    # Тест 1: Проверка статуса при старте
    print("\n1️⃣ Проверка статуса при старте...")
    try:
        response = requests.get(f"{base_url}/memory", timeout=10)
        if response.status_code == 200:
            data = response.json()
            memory_mb = data["memory"]["rss_mb"]
            model_loaded = data["model"]["status"] == "loaded"
            
            print(f"   💾 Использование памяти: {memory_mb:.1f}MB")
            print(f"   🤖 Модель загружена: {model_loaded}")
            
            if not model_loaded and memory_mb < 200:
                print("   ✅ Отлично! Модель не загружена, память в норме")
            elif model_loaded:
                print("   ⚠️  Модель уже загружена при старте")
            else:
                print("   ⚠️  Высокое потребление памяти при старте")
        else:
            print(f"   ❌ Ошибка: {response.status_code}")
    except Exception as e:
        print(f"   ❌ Ошибка подключения: {e}")
        return
    
    # Тест 2: Проверка health endpoint
    print("\n2️⃣ Проверка health endpoint...")
    try:
        response = requests.get(f"{base_url}/health", timeout=10)
        if response.status_code == 200:
            data = response.json()
            print(f"   🏥 Статус: {data['status']}")
            print(f"   🔗 Supabase: {data['supabase_connected']}")
            print(f"   🤖 Модель: {data['model_loaded']}")
        else:
            print(f"   ❌ Ошибка: {response.status_code}")
    except Exception as e:
        print(f"   ❌ Ошибка: {e}")
    
    # Тест 3: Принудительная загрузка модели
    print("\n3️⃣ Принудительная загрузка модели...")
    try:
        response = requests.post(f"{base_url}/model/load", timeout=30)
        if response.status_code == 200:
            data = response.json()
            print(f"   📥 {data['message']}")
            
            # Проверяем память после загрузки
            time.sleep(1)
            response = requests.get(f"{base_url}/memory", timeout=10)
            if response.status_code == 200:
                data = response.json()
                memory_mb = data["memory"]["rss_mb"]
                print(f"   💾 Память после загрузки: {memory_mb:.1f}MB")
                
                if memory_mb > 200:
                    print("   ✅ Модель успешно загружена в память")
                else:
                    print("   ⚠️  Низкое потребление памяти после загрузки")
        else:
            print(f"   ❌ Ошибка: {response.status_code}")
    except Exception as e:
        print(f"   ❌ Ошибка: {e}")
    
    # Тест 4: Выгрузка модели
    print("\n4️⃣ Выгрузка модели...")
    try:
        response = requests.post(f"{base_url}/model/unload", timeout=10)
        if response.status_code == 200:
            data = response.json()
            print(f"   📤 {data['message']}")
            
            # Проверяем память после выгрузки
            time.sleep(1)
            response = requests.get(f"{base_url}/memory", timeout=10)
            if response.status_code == 200:
                data = response.json()
                memory_mb = data["memory"]["rss_mb"]
                model_loaded = data["model"]["status"] == "loaded"
                
                print(f"   💾 Память после выгрузки: {memory_mb:.1f}MB")
                print(f"   🤖 Модель загружена: {model_loaded}")
                
                if not model_loaded:
                    print("   ✅ Модель успешно выгружена")
                else:
                    print("   ⚠️  Модель все еще загружена")
        else:
            print(f"   ❌ Ошибка: {response.status_code}")
    except Exception as e:
        print(f"   ❌ Ошибка: {e}")
    
    print("\n🎉 Тестирование завершено!")

def main():
    """Главная функция"""
    base_url = os.getenv("TEST_BASE_URL", "http://localhost:8000")
    
    print("🚀 Запуск тестов оптимизации памяти")
    print("=" * 50)
    
    test_memory_optimizations(base_url)
    
    print("\n📋 Рекомендации:")
    print("1. Убедитесь, что сервер запущен: python main.py")
    print("2. Проверьте переменные окружения LAZY_LOADING и ENVIRONMENT")
    print("3. Для продакшена установите ENVIRONMENT=production")

if __name__ == "__main__":
    main()
