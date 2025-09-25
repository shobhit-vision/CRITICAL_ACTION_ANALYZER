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
# Add session lifetime (e.g., 24 hours)
app.config['PERMANENT_SESSION_LIFETIME'] = timedelta(hours=24)
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
    analyses_collection = db['analyses']  # New collection for analysis data
    
except Exception as e:
    print(f"❌ Error connecting to MongoDB: {e}")
    # Fallback to local MongoDB if Atlas connection fails
    try:
        client = MongoClient('mongodb://localhost:27017/')
        db = client['action_analyzer_db']
        users_collection = db['users']
        actions_collection = db['actions']
        analyses_collection = db['analyses']
        print("✅ Connected to local MongoDB as fallback")
    except Exception as fallback_error:
        print(f"❌ Fallback connection also failed: {fallback_error}")
        # Set to None to avoid further errors
        client = None
        users_collection = None
        actions_collection = None
        analyses_collection = None

# Clear session on app startup to prevent automatic login after restart
@app.before_request
def clear_session_on_start():
    if not hasattr(app, 'session_cleared'):
        session.clear()
        app.session_cleared = True
        print("Session cleared on app startup")

# Authentication required decorator
def login_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'user_id' not in session:
            # Store the intended destination for redirect after login
            session['next_url'] = request.url
            flash('Please log in to access this page', 'warning')
            return redirect(url_for('login'))
        return f(*args, **kwargs)
    return decorated_function

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
            # Store the intended destination for redirect after login
            if request.endpoint and request.endpoint != 'static':
                session['next_url'] = request.url
            
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
    # Check if we have both session AND a valid token
    if 'user_id' in session:
        # Verify the token is still valid
        token = request.cookies.get('token')
        if token:
            try:
                jwt.decode(token, app.config['JWT_SECRET_KEY'], algorithms=['HS256'])
                return redirect(url_for('dashboard'))
            except:
                # Token is invalid, clear session
                session.clear()
    
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
            
            # Update last login
            users_collection.update_one(
                {'_id': user['_id']}, 
                {'$set': {'last_login': datetime.utcnow()}}
            )
            
            # Generate JWT token
            token = generate_token(user['_id'])
            
            flash('Login successful!', 'success')
            
            # For API requests, return JSON
            # if request.accept_mimetypes.accept_json:
            #     response = jsonify({
            #         'message': 'Login successful',
            #         'user': {
            #             'id': str(user['_id']),
            #             'username': user['username'],
            #             'email': user['email']
            #         }
            #     })
            #     response.set_cookie(
            #         'token', 
            #         token, 
            #         httponly=True, 
            #         secure=True, 
            #         samesite='Lax',
            #         max_age=24*60*60  # 24 hours
            #     )
            #     return response
            
            # For regular web requests, redirect to intended page or dashboard
            next_url = session.pop('next_url', None) or url_for('dashboard')
            response = redirect(next_url)
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
        
        # Check if username already exists
        if users_collection.find_one({'username': username}):
            flash('Username already taken', 'error')
            return render_template("signup.html", title="Sign Up - CRITICAL ACTION ANALYZER")
        
        # Hash password and create user
        try:
            hashed_password = bcrypt.generate_password_hash(password).decode('utf-8')
            user_data = {
                'username': username,
                'email': email,
                'password': hashed_password,
                'created_at': datetime.utcnow(),
                'last_login': datetime.utcnow(),
                'preferences': {
                    'theme': 'light',
                    'notifications': True,
                    'data_sharing': False
                }
            }
            
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
            print(f"Signup error: {e}")
            flash('Error creating account. Please try again.', 'error')
    
    return render_template("signup.html", title="Sign Up - CRITICAL ACTION ANALYZER")

@app.route("/logout")
def logout():
    session.clear()
    flash('You have been logged out', 'info')
    
    response = redirect(url_for('index'))
    response.set_cookie('token', '', expires=0)
    return response

# Manual session clearing endpoint for testing
@app.route("/clear-session")
def clear_session():
    session.clear()
    response = redirect(url_for('index'))
    response.set_cookie('token', '', expires=0)
    flash('Session cleared', 'info')
    return response

# Protected area pages
@app.route("/gait_analysis")
@login_required
def gait_analysis():
    return render_template("gait_analysis.html", title="Physical Healthcare - CRITICAL ACTION ANALYZER")

@app.route("/daily_exercise")
@login_required
def daily_exercise():
    return render_template("daily_exercise.html", title="Daily Exercise - CRITICAL ACTION ANALYZER")

@app.route("/recovery")
@login_required
def recovery():
    return render_template("recovery.html", title="Recovery - CRITICAL ACTION ANALYZER")

@app.route("/therapy")
@login_required
def therapy():
    return render_template("therapy.html", title="Therapy - CRITICAL ACTION ANALYZER")

@app.route("/daily_exercise_documentation")
@login_required
def daily_exercise_documentation():
    return render_template("daily_exercise_documentation.html", title="Daily Exercise - CRITICAL ACTION ANALYZER")

@app.route("/report")
#@login_required
def report():
    return render_template("report.html", title="User Report - CRITICAL ACTION ANALYZER")


@app.route("/emergency_monitoring_documentation")
@login_required
def emergency_monitoring_documentation():
    return render_template("emergency_monitoring_documentation.html", title="Daily Exercise - CRITICAL ACTION ANALYZER")

@app.route("/physical_healthcare_documentation")
@login_required
def physical_healthcare_documentation():
    return render_template("physical_healthcare_documentation.html", title="Physical healthcare documentation - CRITICAL ACTION ANALYZER")

@app.route("/sports_prevention_documentation")
@login_required
def sports_prevention_documentation():
    return render_template("sports_prevention_documentation.html", title="Daily Exercise - CRITICAL ACTION ANALYZER")


@app.route("/sports_prevention")
@login_required
def sports_prevention():
    return render_template("sports_prevention.html", title="Sports Prevention - CRITICAL ACTION ANALYZER")

@app.route("/emergency_monitoring")
@login_required
def emergency_monitoring():
    return render_template("emergency_monitoring.html", title="Emergency Monitoring - CRITICAL ACTION ANALYZER")

@app.route("/dashboard")
@login_required
def dashboard():
    # Get user from session
    user_id = session.get('user_id')
    user = users_collection.find_one({'_id': ObjectId(user_id)})
    
    if not user:
        session.clear()
        flash('User not found. Please log in again.', 'error')
        return redirect(url_for('login'))
    
    # Fetch user-specific data from MongoDB
    user_actions = list(actions_collection.find({'user_id': user_id}).sort('timestamp', -1).limit(10))
    user_analyses = list(analyses_collection.find({'user_id': user_id}).sort('timestamp', -1).limit(5))
    
    # Convert ObjectId to string for JSON serialization
    for action in user_actions:
        action['_id'] = str(action['_id'])
        if 'user_id' in action:
            action['user_id'] = str(action['user_id'])
    
    for analysis in user_analyses:
        analysis['_id'] = str(analysis['_id'])
        if 'user_id' in analysis:
            analysis['user_id'] = str(analysis['user_id'])
    
    return render_template(
        "dashboard.html", 
        title="Dashboard - CRITICAL ACTION ANALYZER", 
        user=user,
        actions=user_actions,
        analyses=user_analyses
    )

@app.route("/settings")
@login_required
def settings():
    # Get user from session
    user_id = session.get('user_id')
    user = users_collection.find_one({'_id': ObjectId(user_id)})
    
    if not user:
        session.clear()
        flash('User not found. Please log in again.', 'error')
        return redirect(url_for('login'))
    
    return render_template("settings.html", title="Settings - CRITICAL ACTION ANALYZER", user=user)

# API Routes for JavaScript
@app.route("/api/user", methods=['GET'])
@token_required
def api_get_user(current_user):
    return jsonify({
        'id': str(current_user['_id']),
        'username': current_user['username'],
        'email': current_user['email'],
        'preferences': current_user.get('preferences', {})
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

@app.route("/api/analyses", methods=['GET', 'POST'])
@token_required
def api_analyses(current_user):
    if request.method == 'GET':
        # Get user's analyses
        limit = int(request.args.get('limit', 5))
        analyses = list(analyses_collection.find({
            'user_id': current_user['_id']
        }).sort('timestamp', -1).limit(limit))
        
        # Convert ObjectId to string
        for analysis in analyses:
            analysis['_id'] = str(analysis['_id'])
            analysis['user_id'] = str(analysis['user_id'])
            if 'timestamp' in analysis and isinstance(analysis['timestamp'], datetime):
                analysis['timestamp'] = analysis['timestamp'].isoformat()
        
        return jsonify(analyses)
    
    elif request.method == 'POST':
        # Save a new analysis
        try:
            data = request.get_json()
            if not data:
                return jsonify({'error': 'No data provided'}), 400
            
            analysis = {
                'user_id': current_user['_id'],
                'analysis_type': data.get('analysis_type', 'pose_estimation'),
                'results': data.get('results', {}),
                'timestamp': datetime.utcnow(),
                'metrics': data.get('metrics', {})
            }
            
            analysis_id = analyses_collection.insert_one(analysis).inserted_id
            return jsonify({
                'success': True, 
                'message': 'Analysis saved',
                'analysis_id': str(analysis_id)
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
        users_collection.create_index("username", unique=True)
        actions_collection.create_index("user_id")
        actions_collection.create_index("timestamp")
        analyses_collection.create_index("user_id")
        analyses_collection.create_index("timestamp")
        print("✅ Database indexes created")
    except Exception as e:
        print(f"❌ Error creating indexes: {e}")
    
    # Run the app
    app.run(host='0.0.0.0', port=5000, debug=True)