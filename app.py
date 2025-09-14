from flask import Flask, render_template

app = Flask(__name__)

@app.route("/")
def index():
    return render_template("index.html", title="CRITICAL ACTION ANALYZER")

@app.route("/dashboard")
def dashboard():
    return render_template("dashboard.html", title="CRITICAL ACTION ANALYZER")


@app.route("/settings")
def settings():
    return render_template("settings.html", title="CRITICAL ACTION ANALYZER")
