from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
import os
from pdf2docx import Converter
from docx import Document
from reportlab.pdfgen import canvas
import uuid
from werkzeug.utils import secure_filename

app = Flask(__name__)
CORS(app)

# Define absolute paths
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
UPLOAD_FOLDER = os.path.join(BASE_DIR, "uploads")
CONVERTED_FOLDER = os.path.join(BASE_DIR, "converted")

# Ensure folders exist
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
os.makedirs(CONVERTED_FOLDER, exist_ok=True)

@app.route("/convert", methods=["POST"])
def convert_file():
    try:
        if "file" not in request.files:
            return jsonify({"error": "No file uploaded"}), 400

        file = request.files["file"]
        conversion_type = request.form.get("type")
        if not conversion_type:
            return jsonify({"error": "Conversion type not specified"}), 400

        # Save uploaded file
        filename = secure_filename(file.filename)
        filepath = os.path.join(UPLOAD_FOLDER, filename)
        file.save(filepath)
        print(f"Uploaded file saved at: {filepath}")

        # Generate a unique filename for the converted file
        unique_filename = f"{filename.split('.')[0]}-{uuid.uuid4().hex}"

        # PDF to DOCX Conversion
        if conversion_type == "pdf-to-docx":
            converted_path = os.path.join(CONVERTED_FOLDER, f"{unique_filename}.docx")
            print(f"Converting PDF to DOCX: {filepath} -> {converted_path}")
            cv = Converter(filepath)
            cv.convert(converted_path, start=0, end=None)
            cv.close()

        # DOCX to PDF Conversion
        elif conversion_type == "docx-to-pdf":
            converted_path = os.path.join(CONVERTED_FOLDER, f"{unique_filename}.pdf")
            print(f"Converting DOCX to PDF: {filepath} -> {converted_path}")

            # Convert DOCX to PDF using ReportLab
            doc = Document(filepath)
            pdf = canvas.Canvas(converted_path)
            pdf.setFont("Helvetica", 12)

            y_position = 800  # Start position
            for para in doc.paragraphs:
                pdf.drawString(50, y_position, para.text)
                y_position -= 20  # Move down for next line

                if y_position < 50:  # New page if too low
                    pdf.showPage()
                    pdf.setFont("Helvetica", 12)
                    y_position = 800

            pdf.save()

        else:
            return jsonify({"error": "Invalid conversion type"}), 400

        # Ensure converted file exists before sending
        if converted_path and os.path.exists(converted_path):
            print(f"Sending file: {converted_path}")
            print(f"File size: {os.path.getsize(converted_path)} bytes")

            return send_file(
                converted_path,
                as_attachment=True,
                download_name=os.path.basename(converted_path),
                mimetype="application/pdf" if conversion_type == "docx-to-pdf" else "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            )

        raise FileNotFoundError(f"Converted file not found: {converted_path}")

    except Exception as e:
        print(f"Error during conversion: {e}")
        return jsonify({"error": f"Conversion failed: {str(e)}"}), 500

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)
