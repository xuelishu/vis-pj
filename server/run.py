from src import app
import os
import json
import math
from flask import Flask, jsonify
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

def sanitize(obj):
    if isinstance(obj, float):
        if math.isnan(obj) or math.isinf(obj):
            return None
        return obj
    elif isinstance(obj, dict):
        return {k: sanitize(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [sanitize(v) for v in obj]
    else:
        return obj
    
@app.route('/api/initial', methods=['GET'])
def get_initdata():
    try:
        with open('./data/emotion_data.json', encoding='utf-8') as f:
            data = sanitize(json.load(f))
    except Exception as e:
        return jsonify({'error': str(e)}), 500
    return jsonify(data)

app.run(host='127.0.0.1', port=5000, use_reloader=True, debug=True)
