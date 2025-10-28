import os, smtplib, ssl
from flask import Flask, render_template, send_file, request, jsonify
from email.message import EmailMessage

app = Flask(__name__)

PDF_PATH = "ContratoAsBasica.pdf"

# ENV requeridos en Render:
# SMTP_USER -> cuenta Gmail de la asesoría (ej: joseedazaa199519@gmail.com)
# SMTP_PASS -> contraseña de aplicación de Gmail (16 caracteres)
# SMTP_TO   -> destinatario (ej: joseedazaa199519@gmail.com)
SMTP_USER = os.environ.get("SMTP_USER")
SMTP_PASS = os.environ.get("SMTP_PASS")
SMTP_TO   = os.environ.get("SMTP_TO", "joseedazaa199519@gmail.com")

@app.route("/")
def index():
    return render_template("index.html")

@app.route("/pdf")
def pdf():
    return send_file(PDF_PATH, as_attachment=False)

@app.route("/submit", methods=["POST"])
def submit():
    # Recibe el PDF firmado (bytes) y lo envía por email a la asesoría
    pdf_bytes = request.get_data()
    if not pdf_bytes:
        return jsonify({"ok": False, "error": "No PDF bytes"}), 400

    if not (SMTP_USER and SMTP_PASS and SMTP_TO):
        return jsonify({"ok": False, "error": "SMTP env vars missing"}), 500

    msg = EmailMessage()
    msg["Subject"] = "Consentimientos - Documento firmado"
    msg["From"] = SMTP_USER
    msg["To"] = SMTP_TO
    msg.set_content("Adjunto el documento firmado.")

    msg.add_attachment(pdf_bytes,
                       maintype="application",
                       subtype="pdf",
                       filename="ContratoFirmado.pdf")

    context = ssl.create_default_context()
    with smtplib.SMTP_SSL("smtp.gmail.com", 465, context=context) as server:
        server.login(SMTP_USER, SMTP_PASS)
        server.send_message(msg)

    return jsonify({"ok": True})
    
if __name__ == "__main__":
    # Para local; en Render usarás: gunicorn app:app
    app.run(host="0.0.0.0", port=5000, debug=False)
