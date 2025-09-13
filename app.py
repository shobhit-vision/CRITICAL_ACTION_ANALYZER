from flask import Flask, render_template

app = Flask(__name__)

@app.route("/")
def hello_world():
    return render_template("index.html", title="CRITICAL ACTION ANALYZER")

@app.route("/dashboard")
def dashboard():
    return render_template("dashboard.html", title="CRITICAL ACTION ANALYZER")
