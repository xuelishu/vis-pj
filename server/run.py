from src import app
import os
import json
import math
from flask import Flask, jsonify,request
from flask_cors import CORS
from datetime import datetime

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
        with open('./data/merged_data_revised.json', encoding='utf-8') as f:
            data = sanitize(json.load(f))
    except Exception as e:
        return jsonify({'error': str(e)}), 500
    return jsonify(data)

@app.route('/api/time_count', methods=['POST'])
def get_time_count():
    """
    期待前端传来类似：
      {
        "time_region_count": ["All", "Weston", ...]
      }
    其中：
    - 请求体的唯一键 "time_region_count" 就是 data/ 目录下的文件名（不含 .json）。
    - 这个键对应的列表（["All","Weston",…]）是要从该 JSON 文件中提取出来的子字段名。
    例如，如果文件是 data/time_region_count.json，并且里面有顶层
      {
        "All": [ … ],
        "Weston": [ … ],
        … 
      }
    我们就依次把选出的 "All" 那段数组 和 "Weston" 那段数组都读出来，然后把它们里每个 {时间: 数量} 
    混在一起、对同一时间戳做累加，最后返回一个合并好的按时间升序的列表。
    """
    try:
        payload = request.get_json(force=True)
        if not payload or len(payload.keys()) != 1:
            return jsonify({'error': '请求体应当只有一个键，对应想查的 JSON 文件名'}), 400

        # --- （1）取出“文件名” 和“要查的子键列表” ---
        # 例如 payload = {"time_region_count": ["All", "Weston"]}
        file_key = list(payload.keys())[0]                 # "time_region_count"
        selected_subkeys = payload[file_key]                # ["All", "Weston"]
        print(selected_subkeys)

        if not isinstance(selected_subkeys, list) or len(selected_subkeys) == 0:
            return jsonify({'error': '对应文件名的值必须是一个非空列表'}), 400

        # data_folder 下应该有 file_key + ".json"
        data_folder = os.path.join(os.getcwd(), 'data')
        target_path = os.path.join(data_folder, f"{file_key}.json")
        if not os.path.isfile(target_path):
            return jsonify({'error': f"找不到对应的文件： data/{file_key}.json"}), 404

        # --- （2）读取并解析这个 JSON 文件（兼容两种常见格式） ---
        try:
            with open(target_path, encoding='utf-8') as f:
                raw = json.load(f)
        except Exception as e:
            return jsonify({'error': f"读取 JSON 失败：{str(e)}"}), 500

        # 如果 raw 是一个列表、而且 list[0] 是个 dict，就取 list[0]
        if isinstance(raw, list) and len(raw) > 0 and isinstance(raw[0], dict):
            region_data = raw[0]
        # 如果 raw 本身就是一个 dict，就直接用它
        elif isinstance(raw, dict):
            region_data = raw
        else:
            return jsonify({'error': 'JSON 文件格式不符合预期：应当是一个 dict，或 list 包一个 dict'}), 500
        if file_key == 'time_word_count':
            # 把原先前端给的 selected_subkeys（如 ['quak']）扩展成真正要遍历的完整子键列表
            expanded = set()
            for pattern in selected_subkeys:
                for real_key in region_data.keys():
                    if pattern in real_key:
                        expanded.add(real_key)
            # 如果没有任何匹配，也可以按需报错，或者直接把 expanded 置空让后面报“子键不存在”
            selected_subkeys = list(expanded)
        # --- （3）把选中的 subkey 对应的数组拿出来，混合累计到一个字典 accum 中 ---
        # accum 的格式：{ "2020-04-06 00:00:00": 累加后的总数, ... }
        print(selected_subkeys)
        accum = {}

        for subkey in selected_subkeys:
            if subkey not in region_data:
                # 如果要的子键在文件中缺失，就跳过，也可以改为直接报错
                # return jsonify({'error': f"子键 {subkey} 在 {file_key}.json 中不存在"}), 400
                continue

            arr = region_data[subkey]
            if not isinstance(arr, list):
                # 如果不是列表，跳过
                continue

            for item in arr:
                # item 可能是 { "time": "...", "count": n }，也可能是 { "2020-04-06 00:00:00": n }
                if isinstance(item, dict) and 'time' in item and 'count' in item:
                    tstr = item['time']
                    cval = item['count']
                elif isinstance(item, dict):
                    # 直接取 dict 第一个 key/value
                    tstr, cval = next(iter(item.items()))
                else:
                    continue

                # 尝试把 cval 变成数字
                try:
                    cval = int(cval)
                except:
                    try:
                        cval = float(cval)
                    except:
                        cval = 0

                # 把同一时间戳的值累加进去
                accum[tstr] = accum.get(tstr, 0) + cval

        # 如果遍历完后 accum 还是空，说明所有 subkey 都没在文件中匹配到
        if not accum:
            return jsonify({'error': '没有获取到任何时间数据，可能子键都不存在或数据格式不对'}), 400

        # --- （4）把 accum 转成按时间升序的列表，格式为 [{time: "...", count: N}, ...] ---
        result_list = []
        # 先尝试用 datetime 排序，格式假设为 "YYYY-MM-DD HH:MM:SS"
        try:
            sorted_items = sorted(
                accum.items(),
                key=lambda x: datetime.strptime(x[0], '%Y-%m-%d %H:%M:%S')
            )
        except Exception:
            # 如果有格式不一致的，就回退按 key 排序字符串
            sorted_items = sorted(accum.items(), key=lambda x: x[0])

        for tstr, total_count in sorted_items:
            result_list.append({'time': tstr, 'count': total_count})

        # --- （5）返回最终结果 ---
        return jsonify({'data': result_list})

    except Exception as e:
        # 捕获任意未预料的错误
        return jsonify({'error': str(e)}), 500

app.run(host='127.0.0.1', port=5000, use_reloader=True, debug=True)
