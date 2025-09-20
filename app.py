from flask import Flask, render_template, request, redirect, url_for, session, flash, jsonify
from flask_bcrypt import Bcrypt
from pymongo import MongoClient
from bson.objectid import ObjectId
import os
from datetime import datetime, timedelta
import jwt
from functools import wraps
import json
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

app = Flask(__name__)
app.secret_key = os.environ.get('SECRET_KEY', os.urandom(24))
app.config['JWT_SECRET_KEY'] = os.environ.get('JWT_SECRET_KEY', 'jwt-secret-key-change-in-production')
app.config['JWT_ACCESS_TOKEN_EXPIRES'] = timedelta(hours=24)
bcrypt = Bcrypt(app)

# MongoDB connection from secret
try:
    MONGODB_URI = os.environ.get('MONGODB_URL', 'mongodb://localhost:27017/')
    client = MongoClient(MONGODB_URI)
    
    # Test the connection
    client.admin.command('ping')
    print("✅ Successfully connected to MongoDB Atlas!")
    
    db = client['action_analyzer_db']
    users_collection = db['users']
    actions_collection = db['actions']
    
except Exception as e:
    print(f"❌ Error connecting to MongoDB: {e}")
    # Fallback to local MongoDB if Atlas connection fails
    try:
        client = MongoClient('mongodb://localhost:27017/')
        db = client['action_analyzer_db']
        users_collection = db['users']
        actions_collection = db['actions']
        print("✅ Connected to local MongoDB as fallback")
    except Exception as fallback_error:
        print(f"❌ Fallback connection also failed: {fallback_error}")
        # Set to None to avoid further errors
        client = None
        users_collection = None
        actions_collection = None

# JWT Token required decorator
def token_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        token = None
        
        # Check for token in cookies first
        if 'token' in request.cookies:
            token = request.cookies.get('token')
        
        # Then check Authorization header
        if not token and 'Authorization' in request.headers:
            auth_header = request.headers['Authorization']
            if auth_header.startswith('Bearer '):
                token = auth_header.split(' ')[1]
        
        if not token:
            if request.accept_mimetypes.accept_json:
                return jsonify({'message': 'Token is missing!'}), 401
            flash('Please login to access this page', 'error')
            return redirect(url_for('login'))
        
        try:
            data = jwt.decode(token, app.config['JWT_SECRET_KEY'], algorithms=['HS256'])
            current_user = users_collection.find_one({'_id': ObjectId(data['user_id'])})
            if not current_user:
                raise ValueError("User not found")
        except Exception as e:
            if request.accept_mimetypes.accept_json:
                return jsonify({'message': 'Token is invalid!', 'error': str(e)}), 401
            flash('Session expired. Please login again', 'error')
            return redirect(url_for('login'))
        
        return f(current_user, *args, **kwargs)
    
    return decorated

# Generate JWT Token
def generate_token(user_id):
    try:
        payload = {
            'user_id': str(user_id),
            'exp': datetime.utcnow() + app.config['JWT_ACCESS_TOKEN_EXPIRES'],
            'iat': datetime.utcnow()
        }
        token = jwt.encode(payload, app.config['JWT_SECRET_KEY'], algorithm='HS256')
        return token
    except Exception as e:
        print(f"Error generating token: {e}")
        return None

@app.route("/")
def index():
    if 'user_id' in session:
        return redirect(url_for('dashboard'))
    return render_template("index.html", title="CRITICAL ACTION ANALYZER")

@app.route("/login", methods=['GET', 'POST'])
def login():
    if 'user_id' in session:
        return redirect(url_for('dashboard'))
    
    if request.method == 'POST':
        email = request.form.get('email')
        password = request.form.get('password')
        
        if not email or not password:
            flash('Please fill all fields', 'error')
            return render_template("login.html", title="Login - CRITICAL ACTION ANALYZER")
        
        # Check if user exists
        user = users_collection.find_one({'email': email})
        
        if user and bcrypt.check_password_hash(user['password'], password):
            session['user_id'] = str(user['_id'])
            session['username'] = user['username']
            
            # Generate JWT token
            token = generate_token(user['_id'])
            
            flash('Login successful!', 'success')
            
            # For API requests, return JSON
            if request.accept_mimetypes.accept_json:
                response = jsonify({
                    'message': 'Login successful',
                    'user': {
                        'id': str(user['_id']),
                        'username': user['username'],
                        'email': user['email']
                    }
                })
                response.set_cookie(
                    'token', 
                    token, 
                    httponly=True, 
                    secure=True, 
                    samesite='Lax',
                    max_age=24*60*60  # 24 hours
                )
                return response
            
            # For regular web requests, redirect to dashboard
            response = redirect(url_for('dashboard'))
            response.set_cookie(
                'token', 
                token, 
                httponly=True, 
                secure=False,  # Set to True in production with HTTPS
                samesite='Lax',
                max_age=24*60*60  # 24 hours
            )
            return response
        else:
            flash('Invalid email or password', 'error')
    
    return render_template("login.html", title="Login - CRITICAL ACTION ANALYZER")

@app.route("/signup", methods=['GET', 'POST'])
def signup():
    if 'user_id' in session:
        return redirect(url_for('dashboard'))
    
    if request.method == 'POST':
        username = request.form.get('username')
        email = request.form.get('email')
        password = request.form.get('password')
        confirm_password = request.form.get('confirm_password')
        
        if not all([username, email, password, confirm_password]):
            flash('Please fill all fields', 'error')
            return render_template("signup.html", title="Sign Up - CRITICAL ACTION ANALYZER")
        
        # Validation
        if password != confirm_password:
            flash('Passwords do not match', 'error')
            return render_template("signup.html", title="Sign Up - CRITICAL ACTION ANALYZER")
        
        if len(password) < 6:
            flash('Password must be at least 6 characters', 'error')
            return render_template("signup.html", title="Sign Up - CRITICAL ACTION ANALYZER")
        
        # Check if user already exists
        if users_collection.find_one({'email': email}):
            flash('Email already registered', 'error')
            return render_template("signup.html", title="Sign Up - CRITICAL ACTION ANALYZER")
        
        # Hash password and create user
        hashed_password = bcrypt.generate_password_hash(password).decode('utf-8')
        user_data = {
            'username': username,
            'email': email,
            'password': hashed_password,
            'created_at': datetime.utcnow(),
            'last_login': datetime.utcnow()
        }
        
        try:
            user_id = users_collection.insert_one(user_data).inserted_id
            session['user_id'] = str(user_id)
            session['username'] = username
            
            # Generate JWT token
            token = generate_token(user_id)
            
            flash('Account created successfully!', 'success')
            
            # For API requests
            if request.accept_mimetypes.accept_json:
                response = jsonify({
                    'message': 'Account created successfully',
                    'user': {
                        'id': str(user_id),
                        'username': username,
                        'email': email
                    }
                })
                response.set_cookie(
                    'token', 
                    token, 
                    httponly=True, 
                    secure=True, 
                    samesite='Lax',
                    max_age=24*60*60
                )
                return response
            
            # For web requests
            response = redirect(url_for('dashboard'))
            response.set_cookie(
                'token', 
                token, 
                httponly=True, 
                secure=False,  # Set to True in production with HTTPS
                samesite='Lax',
                max_age=24*60*60
            )
            return response
            
        except Exception as e:
            flash(f'Error creating account: {str(e)}', 'error')
            print(f"Signup error: {e}")
    
    return render_template("signup.html", title="Sign Up - CRITICAL ACTION ANALYZER")

@app.route("/logout")
def logout():
    session.clear()
    flash('You have been logged out', 'info')
    
    response = redirect(url_for('index'))
    response.set_cookie('token', '', expires=0)
    return response

@app.route("/dashboard")
@token_required
def dashboard(current_user):
    # Fetch user-specific data from MongoDB
    user_actions = list(actions_collection.find({'user_id': current_user['_id']}).sort('timestamp', -1).limit(10))
    
    # Convert ObjectId to string for JSON serialization
    for action in user_actions:
        action['_id'] = str(action['_id'])
        if 'user_id' in action:
            action['user_id'] = str(action['user_id'])
    
    return render_template(
        "dashboard.html", 
        title="Dashboard - CRITICAL ACTION ANALYZER", 
        user=current_user,
        actions=user_actions
    )

@app.route("/settings")
@token_required
def settings(current_user):
    return render_template("settings.html", title="Settings - CRITICAL ACTION ANALYZER", user=current_user)

# API Routes for JavaScript
@app.route("/api/user", methods=['GET'])
@token_required
def api_get_user(current_user):
    return jsonify({
        'id': str(current_user['_id']),
        'username': current_user['username'],
        'email': current_user['email']
    })

@app.route("/api/actions", methods=['GET', 'POST'])
@token_required
def api_actions(current_user):
    if request.method == 'GET':
        # Get user's actions
        limit = int(request.args.get('limit', 10))
        actions = list(actions_collection.find({
            'user_id': current_user['_id']
        }).sort('timestamp', -1).limit(limit))
        
        # Convert ObjectId to string
        for action in actions:
            action['_id'] = str(action['_id'])
            action['user_id'] = str(action['user_id'])
            if 'timestamp' in action and isinstance(action['timestamp'], datetime):
                action['timestamp'] = action['timestamp'].isoformat()
        
        return jsonify(actions)
    
    elif request.method == 'POST':
        # Create a new action
        try:
            data = request.get_json()
            if not data:
                return jsonify({'error': 'No data provided'}), 400
            
            action = {
                'user_id': current_user['_id'],
                'action_type': data.get('action_type', 'unknown'),
                'description': data.get('description', ''),
                'timestamp': datetime.utcnow(),
                'metadata': data.get('metadata', {})
            }
            
            action_id = actions_collection.insert_one(action).inserted_id
            return jsonify({
                'success': True, 
                'message': 'Action recorded',
                'action_id': str(action_id)
            }), 201
            
        except Exception as e:
            return jsonify({'error': str(e)}), 500

# Health check endpoint
@app.route("/health")
def health():
    try:
        # Check MongoDB connection
        if client:
            client.admin.command('ping')
            db_status = "connected"
        else:
            db_status = "disconnected"
        
        return jsonify({
            "status": "healthy",
            "database": db_status,
            "timestamp": datetime.utcnow().isoformat()
        })
    except Exception as e:
        return jsonify({
            "status": "unhealthy",
            "database": "disconnected",
            "error": str(e),
            "timestamp": datetime.utcnow().isoformat()
        }), 500

if __name__ == "__main__":
    # Create indexes for better performance
    try:
        users_collection.create_index("email", unique=True)
        actions_collection.create_index("user_id")
        actions_collection.create_index("timestamp")
        print("✅ Database indexes created")
    except Exception as e:
        print(f"❌ Error creating indexes: {e}")
    
    # Run the app
    app.run(host='0.0.0.0', port=5000, debug=True)