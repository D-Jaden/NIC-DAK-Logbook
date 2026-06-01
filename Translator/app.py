from flask import Flask, request, jsonify
from flask_cors import CORS
from deep_translator import GoogleTranslator

app = Flask(__name__)
CORS(app)

@app.route('/translate', methods=['POST'])
def translate():
    data = request.get_json()
    text = data.get('text', '').strip()

    if not text:
        return jsonify({'error': 'No text provided'}), 400

    try:
        translated = GoogleTranslator(source='en', target='hi').translate(text)
        return jsonify({'translated_text': translated})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/batch_translate', methods=['POST'])
def batch_translate():
    data = request.get_json()
    texts = data.get('texts', [])

    if not texts:
        return jsonify({'error': 'No texts provided'}), 400

    translator = GoogleTranslator(source='en', target='hi')
    results = []

    for text in texts:
        try:
            translated = translator.translate(text.strip())
            results.append({'translated_text': translated})
        except Exception as e:
            results.append({'error': str(e)})

    return jsonify({'results': results})


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=7860)