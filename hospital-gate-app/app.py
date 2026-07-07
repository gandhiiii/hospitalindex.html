import os
import json
import io
import base64
import random
import string
from datetime import datetime, timedelta
from functools import wraps

import qrcode
from flask import (
    Flask, render_template, request, jsonify, session,
    redirect, url_for, flash, send_file
)
from flask_sqlalchemy import SQLAlchemy
from flask_login import LoginManager, UserMixin, login_user, logout_user, login_required, current_user
from flask_bcrypt import Bcrypt
from apscheduler.schedulers.background import BackgroundScheduler

app = Flask(__name__)
app.config['SECRET_KEY'] = 'hospital-gate-secure-key-2026'
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///hospital_gate.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

db = SQLAlchemy(app)
bcrypt = Bcrypt(app)
login_manager = LoginManager(app)
login_manager.login_view = 'login'

scheduler = BackgroundScheduler()
scheduler.start()

# ─── Models ───────────────────────────────────────────────────────────────────

class User(db.Model, UserMixin):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    password_hash = db.Column(db.String(200), nullable=False)
    role = db.Column(db.String(20), nullable=False, default='guard')
    full_name = db.Column(db.String(100), nullable=False)
    phone = db.Column(db.String(20))
    email = db.Column(db.String(100))
    is_active = db.Column(db.Boolean, default=True)

    def set_password(self, password):
        self.password_hash = bcrypt.generate_password_hash(password).decode('utf-8')

    def check_password(self, password):
        return bcrypt.check_password_hash(self.password_hash, password)


class Gate(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    location = db.Column(db.String(200))
    status = db.Column(db.String(20), default='closed')
    mode = db.Column(db.String(20), default='auto')
    last_activity = db.Column(db.DateTime, default=datetime.utcnow)


class Visitor(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    phone = db.Column(db.String(20))
    email = db.Column(db.String(100))
    id_card = db.Column(db.String(50))
    vehicle_number = db.Column(db.String(50))
    purpose = db.Column(db.String(200))
    department = db.Column(db.String(100))
    person_to_meet = db.Column(db.String(100))
    qr_code = db.Column(db.Text)
    pass_code = db.Column(db.String(20), unique=True)
    status = db.Column(db.String(20), default='pending')
    valid_from = db.Column(db.DateTime, default=datetime.utcnow)
    valid_until = db.Column(db.DateTime)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)


class EntryLog(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    gate_id = db.Column(db.Integer, db.ForeignKey('gate.id'))
    visitor_id = db.Column(db.Integer, db.ForeignKey('visitor.id'), nullable=True)
    entry_type = db.Column(db.String(10))
    vehicle_number = db.Column(db.String(50))
    visitor_name = db.Column(db.String(100))
    category = db.Column(db.String(30))
    number_plate = db.Column(db.String(50))
    confidence = db.Column(db.Float)
    is_emergency = db.Column(db.Boolean, default=False)
    is_authorized = db.Column(db.Boolean, default=False)
    is_pre_registered = db.Column(db.Boolean, default=False)
    timestamp = db.Column(db.DateTime, default=datetime.utcnow)
    direction = db.Column(db.String(10))
    processed_by = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=True)


class Alert(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    type = db.Column(db.String(50))
    message = db.Column(db.String(500))
    severity = db.Column(db.String(20), default='info')
    is_read = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)


class ScheduledEntry(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    visitor_name = db.Column(db.String(100))
    vehicle_number = db.Column(db.String(50))
    department = db.Column(db.String(100))
    scheduled_time = db.Column(db.DateTime)
    status = db.Column(db.String(20), default='scheduled')
    created_at = db.Column(db.DateTime, default=datetime.utcnow)


# ─── Helpers ──────────────────────────────────────────────────────────────────

def admin_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        if not current_user.is_authenticated or current_user.role != 'admin':
            return jsonify({'error': 'Admin access required'}), 403
        return f(*args, **kwargs)
    return decorated


def generate_pass_code():
    return ''.join(random.choices(string.ascii_uppercase + string.digits, k=8))


def simulate_anpr(image_data=None):
    plates = ['MH01AB1234', 'MH02CD5678', 'MH03EF9012', 'MH04GH3456',
              'DL01JK7890', 'KA01LM1234', 'TN01NO5678', 'GJ01PQ9012',
              'WB01RS3456', 'UP01TU7890', 'HR01VW1234', 'RJ01XY5678']
    plate = random.choice(plates)
    confidence = round(random.uniform(78.5, 99.9), 1)
    return {'plate': plate, 'confidence': confidence, 'detected': True}


def generate_qr(data_dict):
    data_str = json.dumps(data_dict)
    qr = qrcode.QRCode(box_size=10, border=4)
    qr.add_data(data_str)
    qr.make(fit=True)
    img = qr.make_image(fill='black', back_color='white')
    buf = io.BytesIO()
    img.save(buf, format='PNG')
    return base64.b64encode(buf.getvalue()).decode('utf-8')


def create_alert(atype, message, severity='info'):
    alert = Alert(type=atype, message=message, severity=severity)
    db.session.add(alert)
    db.session.commit()


def send_sms(phone, message):
    print(f"[SMS] To: {phone} | Message: {message}")
    create_alert('sms', f'SMS sent to {phone}: {message}', 'info')
    return True


def send_email(email, subject, message):
    print(f"[EMAIL] To: {email} | Subject: {subject} | Message: {message}")
    create_alert('email', f'Email sent to {email}: {subject}', 'info')
    return True


def auto_close_gates():
    gates = Gate.query.filter_by(status='open').all()
    for gate in gates:
        gate.status = 'closed'
        gate.last_activity = datetime.utcnow()
        create_alert('auto_close', f'Gate {gate.name} auto-closed after timeout', 'warning')
    db.session.commit()


scheduler.add_job(func=auto_close_gates, trigger='interval', seconds=300, id='auto_close_gates')


def seed_data():
    if User.query.count() == 0:
        admin = User(username='admin', role='admin', full_name='System Admin',
                     phone='+911234567890', email='admin@hospital.com')
        admin.set_password('admin123')
        db.session.add(admin)
        guard = User(username='guard1', role='guard', full_name='Security Guard 1',
                     phone='+911234567891', email='guard1@hospital.com')
        guard.set_password('guard123')
        db.session.add(guard)

    if Gate.query.count() == 0:
        for i, (name, loc) in enumerate([
            ('Main Gate', 'Main Entrance - Emergency Road'),
            ('Staff Gate', 'Staff Parking - East Wing'),
            ('Service Gate', 'Service Entry - West Wing'),
            ('VIP Gate', 'VIP Entrance - North Block'),
            ('Parking Gate', 'Multi-level Parking Entrance'),
        ], 1):
            db.session.add(Gate(name=name, location=loc, status='closed', mode='auto'))

    if Visitor.query.count() == 0:
        v = Visitor(
            name='Dr. Sharma', phone='+919999999991', email='dr.sharma@hospital.com',
            id_card='DOC001', vehicle_number='MH01AB1234',
            purpose='Medical Staff - Doctor', department='Cardiology',
            person_to_meet='Self', pass_code=generate_pass_code(),
            status='approved', valid_until=datetime.utcnow() + timedelta(days=365)
        )
        v.qr_code = generate_qr({'name': v.name, 'pass_code': v.pass_code, 'vehicle': v.vehicle_number})
        db.session.add(v)

        v2 = Visitor(
            name='Patient Visitor', phone='+919999999992',
            vehicle_number='MH02CD5678', purpose='Visiting Patient',
            department='General Ward', person_to_meet='Patient Ravi',
            pass_code=generate_pass_code(), status='approved',
            valid_until=datetime.utcnow() + timedelta(days=1)
        )
        v2.qr_code = generate_qr({'name': v2.name, 'pass_code': v2.pass_code, 'vehicle': v2.vehicle_number})
        db.session.add(v2)

    db.session.commit()


with app.app_context():
    db.create_all()
    seed_data()


# ─── Auth Routes ──────────────────────────────────────────────────────────────

@login_manager.user_loader
def load_user(user_id):
    return db.session.get(User, int(user_id))


@app.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'POST':
        data = request.get_json() if request.is_json else request.form
        user = User.query.filter_by(username=data.get('username')).first()
        if user and user.check_password(data.get('password')) and user.is_active:
            login_user(user, remember=True)
            return jsonify({'success': True, 'role': user.role, 'name': user.full_name})
        return jsonify({'success': False, 'error': 'Invalid credentials'}), 401
    return render_template('login.html')


@app.route('/logout')
@login_required
def logout():
    logout_user()
    return redirect(url_for('login'))


@app.route('/api/auth/me')
@login_required
def auth_me():
    return jsonify({
        'id': current_user.id, 'username': current_user.username,
        'role': current_user.role, 'name': current_user.full_name,
        'phone': current_user.phone, 'email': current_user.email
    })


# ─── Dashboard Routes ─────────────────────────────────────────────────────────

@app.route('/')
@login_required
def index():
    return render_template('dashboard.html', role=current_user.role)


@app.route('/dashboard')
@login_required
def dashboard():
    return render_template('dashboard.html', role=current_user.role)


@app.route('/api/dashboard/stats')
@login_required
def dashboard_stats():
    today = datetime.utcnow().date()
    today_start = datetime(today.year, today.month, today.day)

    total_entries = EntryLog.query.count()
    today_entries = EntryLog.query.filter(EntryLog.timestamp >= today_start).count()
    today_entry_count = EntryLog.query.filter(
        EntryLog.timestamp >= today_start, EntryLog.direction == 'entry'
    ).count()
    today_exit_count = EntryLog.query.filter(
        EntryLog.timestamp >= today_start, EntryLog.direction == 'exit'
    ).count()
    today_emergency = EntryLog.query.filter(
        EntryLog.timestamp >= today_start, EntryLog.is_emergency == True
    ).count()
    pending_visitors = Visitor.query.filter_by(status='pending').count()
    active_visitors_inside = EntryLog.query.filter(
        EntryLog.direction == 'entry', EntryLog.timestamp >= today_start
    ).count() - EntryLog.query.filter(
        EntryLog.direction == 'exit', EntryLog.timestamp >= today_start
    ).count()
    if active_visitors_inside < 0:
        active_visitors_inside = 0

    unread_alerts = Alert.query.filter_by(is_read=False).count()

    gates = Gate.query.all()
    gate_statuses = {g.id: g.status for g in gates}
    open_gates = sum(1 for s in gate_statuses.values() if s == 'open')

    return jsonify({
        'total_entries': total_entries,
        'today_entries': today_entries,
        'today_entry': today_entry_count,
        'today_exit': today_exit_count,
        'today_emergency': today_emergency,
        'pending_visitors': pending_visitors,
        'active_inside': max(0, active_visitors_inside),
        'unread_alerts': unread_alerts,
        'total_gates': len(gates),
        'open_gates': open_gates
    })


@app.route('/api/dashboard/recent')
@login_required
def dashboard_recent():
    logs = EntryLog.query.order_by(EntryLog.timestamp.desc()).limit(10).all()
    return jsonify([{
        'id': l.id, 'vehicle': l.vehicle_number or l.number_plate,
        'visitor': l.visitor_name, 'category': l.category,
        'direction': l.direction, 'is_emergency': l.is_emergency,
        'is_authorized': l.is_authorized, 'gate_id': l.gate_id,
        'timestamp': l.timestamp.isoformat()
    } for l in logs])


@app.route('/api/dashboard/hourly')
@login_required
def dashboard_hourly():
    today = datetime.utcnow().date()
    today_start = datetime(today.year, today.month, today.day)
    hours = []
    for h in range(24):
        hstart = today_start + timedelta(hours=h)
        hend = hstart + timedelta(hours=1)
        cnt = EntryLog.query.filter(
            EntryLog.timestamp >= hstart, EntryLog.timestamp < hend
        ).count()
        hours.append({'hour': f'{h:02d}:00', 'count': cnt})
    return jsonify(hours)


# ─── Gate Control Routes ─────────────────────────────────────────────────────

@app.route('/gates')
@login_required
def gates_page():
    return render_template('gates.html', role=current_user.role)


@app.route('/api/gates')
@login_required
def get_gates():
    gates = Gate.query.all()
    return jsonify([{
        'id': g.id, 'name': g.name, 'location': g.location,
        'status': g.status, 'mode': g.mode,
        'last_activity': g.last_activity.isoformat() if g.last_activity else None
    } for g in gates])


@app.route('/api/gates/<int:gate_id>/open', methods=['POST'])
@login_required
def open_gate(gate_id):
    gate = db.session.get(Gate, gate_id)
    if not gate:
        return jsonify({'error': 'Gate not found'}), 404
    gate.status = 'open'
    gate.last_activity = datetime.utcnow()
    db.session.commit()
    create_alert('gate', f'Gate {gate.name} opened by {current_user.full_name}', 'info')
    return jsonify({'success': True, 'status': 'open'})


@app.route('/api/gates/<int:gate_id>/close', methods=['POST'])
@login_required
def close_gate(gate_id):
    gate = db.session.get(Gate, gate_id)
    if not gate:
        return jsonify({'error': 'Gate not found'}), 404
    gate.status = 'closed'
    gate.last_activity = datetime.utcnow()
    db.session.commit()
    create_alert('gate', f'Gate {gate.name} closed by {current_user.full_name}', 'info')
    return jsonify({'success': True, 'status': 'closed'})


@app.route('/api/gates/<int:gate_id>/mode', methods=['POST'])
@login_required
def set_gate_mode(gate_id):
    gate = db.session.get(Gate, gate_id)
    if not gate:
        return jsonify({'error': 'Gate not found'}), 404
    mode = request.json.get('mode', 'auto')
    if mode not in ['auto', 'manual', 'emergency']:
        return jsonify({'error': 'Invalid mode'}), 400
    gate.mode = mode
    if mode == 'emergency':
        gate.status = 'open'
    db.session.commit()
    create_alert('gate', f'Gate {gate.name} set to {mode} mode by {current_user.full_name}',
                 'warning' if mode == 'emergency' else 'info')
    return jsonify({'success': True, 'mode': mode})


@app.route('/api/gates/<int:gate_id>/status')
@login_required
def gate_status(gate_id):
    gate = db.session.get(Gate, gate_id)
    if not gate:
        return jsonify({'error': 'Gate not found'}), 404
    return jsonify({'id': gate.id, 'status': gate.status, 'mode': gate.mode})


@app.route('/api/gates/all/emergency-open', methods=['POST'])
@login_required
@admin_required
def emergency_open_all():
    gates = Gate.query.all()
    for gate in gates:
        gate.status = 'open'
        gate.mode = 'emergency'
        gate.last_activity = datetime.utcnow()
    db.session.commit()
    create_alert('emergency', f'EMERGENCY: All gates opened by {current_user.full_name}', 'critical')
    return jsonify({'success': True, 'message': 'All gates opened in emergency mode'})


@app.route('/api/gates/all/reset', methods=['POST'])
@login_required
@admin_required
def reset_all_gates():
    gates = Gate.query.all()
    for gate in gates:
        gate.status = 'closed'
        gate.mode = 'auto'
        gate.last_activity = datetime.utcnow()
    db.session.commit()
    create_alert('gate', f'All gates reset to auto/closed by {current_user.full_name}', 'info')
    return jsonify({'success': True, 'message': 'All gates reset to auto mode'})


# ─── Entry/Exit Routes ────────────────────────────────────────────────────────

@app.route('/entry')
@login_required
def entry_page():
    return render_template('entry.html', role=current_user.role)


@app.route('/api/entry/register', methods=['POST'])
@login_required
def register_entry():
    data = request.json
    direction = data.get('direction', 'entry')
    gate_id = data.get('gate_id', 1)
    vehicle_number = data.get('vehicle_number', '').upper().strip()
    visitor_name = data.get('visitor_name', 'Unknown')
    category = data.get('category', 'general')
    is_emergency = data.get('is_emergency', False)
    pass_code = data.get('pass_code', '')
    manual_plate = data.get('manual_plate', '')

    gate = db.session.get(Gate, gate_id)
    if not gate:
        return jsonify({'error': 'Invalid gate'}), 400

    number_plate = manual_plate.upper().strip() if manual_plate else ''
    confidence = 0

    if not number_plate and vehicle_number:
        number_plate = vehicle_number

    if not number_plate:
        anpr_result = simulate_anpr()
        number_plate = anpr_result['plate']
        confidence = anpr_result['confidence']

    is_pre_registered = False
    visitor_id = None

    if pass_code:
        visitor = Visitor.query.filter_by(pass_code=pass_code, status='approved').first()
        if visitor:
            is_pre_registered = True
            visitor_id = visitor.id
            visitor_name = visitor.name
            if not vehicle_number:
                vehicle_number = visitor.vehicle_number or number_plate
            category = visitor.purpose or category
            if direction == 'entry':
                visitor.last_entry = datetime.utcnow()
        else:
            create_alert('security', f'Invalid pass code attempt: {pass_code}', 'warning')

    is_authorized = is_pre_registered or direction == 'exit'

    if is_emergency:
        gate.status = 'open'
        gate.last_activity = datetime.utcnow()
        is_authorized = True
        create_alert('emergency', f'Emergency {direction} at {gate.name}: {number_plate}', 'critical')

    if gate.mode == 'auto' and (is_authorized or is_emergency):
        gate.status = 'open'
        gate.last_activity = datetime.utcnow()

    log = EntryLog(
        gate_id=gate_id, visitor_id=visitor_id, entry_type='vehicle',
        vehicle_number=vehicle_number or number_plate, visitor_name=visitor_name,
        category=category, number_plate=number_plate, confidence=confidence,
        is_emergency=is_emergency, is_authorized=is_authorized,
        is_pre_registered=is_pre_registered, direction=direction,
        processed_by=current_user.id
    )
    db.session.add(log)
    db.session.commit()

    if direction == 'entry' and is_authorized:
        create_alert('entry', f'{visitor_name} ({number_plate}) entered via {gate.name}', 'info')

    return jsonify({
        'success': True, 'log_id': log.id,
        'number_plate': number_plate, 'confidence': confidence,
        'is_authorized': is_authorized, 'is_pre_registered': is_pre_registered,
        'gate_opened': gate.status == 'open',
        'gate_status': gate.status,
        'visitor_name': visitor_name
    })


@app.route('/api/entry/anpr', methods=['POST'])
@login_required
def anpr_scan():
    result = simulate_anpr(request.files.get('image'))
    return jsonify(result)


@app.route('/api/entry/logs')
@login_required
def entry_logs():
    page = request.args.get('page', 1, type=int)
    per_page = 20
    direction = request.args.get('direction', '')
    query = EntryLog.query
    if direction:
        query = query.filter_by(direction=direction)
    logs = query.order_by(EntryLog.timestamp.desc()).offset((page - 1) * per_page).limit(per_page).all()
    total = query.count()
    return jsonify({
        'logs': [{
            'id': l.id, 'gate_id': l.gate_id,
            'vehicle': l.vehicle_number or l.number_plate,
            'visitor': l.visitor_name, 'category': l.category,
            'number_plate': l.number_plate, 'confidence': l.confidence,
            'is_emergency': l.is_emergency, 'is_authorized': l.is_authorized,
            'is_pre_registered': l.is_pre_registered,
            'direction': l.direction, 'timestamp': l.timestamp.isoformat(),
            'gate_name': db.session.get(Gate, l.gate_id).name if db.session.get(Gate, l.gate_id) else 'Unknown'
        } for l in logs],
        'total': total, 'page': page, 'pages': (total + per_page - 1) // per_page
    })


# ─── Visitor Management Routes ────────────────────────────────────────────────

@app.route('/visitors')
@login_required
def visitors_page():
    return render_template('visitors.html', role=current_user.role)


@app.route('/api/visitors')
@login_required
def get_visitors():
    visitors = Visitor.query.order_by(Visitor.created_at.desc()).all()
    return jsonify([{
        'id': v.id, 'name': v.name, 'phone': v.phone, 'email': v.email,
        'id_card': v.id_card, 'vehicle_number': v.vehicle_number,
        'purpose': v.purpose, 'department': v.department,
        'person_to_meet': v.person_to_meet, 'pass_code': v.pass_code,
        'status': v.status, 'qr_code': v.qr_code,
        'valid_from': v.valid_from.isoformat() if v.valid_from else None,
        'valid_until': v.valid_until.isoformat() if v.valid_until else None,
        'created_at': v.created_at.isoformat() if v.created_at else None
    } for v in visitors])


@app.route('/api/visitors/create', methods=['POST'])
@login_required
def create_visitor():
    data = request.json
    pass_code = generate_pass_code()
    valid_until = datetime.utcnow() + timedelta(
        days=data.get('valid_days', 1)
    )
    v = Visitor(
        name=data['name'], phone=data.get('phone', ''),
        email=data.get('email', ''), id_card=data.get('id_card', ''),
        vehicle_number=data.get('vehicle_number', '').upper(),
        purpose=data.get('purpose', 'Visit'), department=data.get('department', ''),
        person_to_meet=data.get('person_to_meet', ''),
        pass_code=pass_code, status='approved',
        valid_until=valid_until
    )
    v.qr_code = generate_qr({
        'name': v.name, 'pass_code': v.pass_code,
        'vehicle': v.vehicle_number, 'id': v.id_card
    })
    db.session.add(v)
    db.session.commit()

    if v.phone:
        send_sms(v.phone, f'Hospital Gate Pass: {v.pass_code}. Valid till {valid_until.date()}. Show QR at gate.')
    if v.email:
        send_email(v.email, 'Your Hospital Gate Pass',
                   f'Pass Code: {v.pass_code}\nValid until: {valid_until.date()}')

    create_alert('visitor', f'Visitor {v.name} registered with pass {v.pass_code}', 'info')
    return jsonify({'success': True, 'visitor': {
        'id': v.id, 'name': v.name, 'pass_code': v.pass_code,
        'qr_code': v.qr_code
    }})


@app.route('/api/visitors/<int:visitor_id>/status', methods=['POST'])
@login_required
def update_visitor_status(visitor_id):
    v = db.session.get(Visitor, visitor_id)
    if not v:
        return jsonify({'error': 'Visitor not found'}), 404
    v.status = request.json.get('status', v.status)
    db.session.commit()
    return jsonify({'success': True, 'status': v.status})


@app.route('/api/visitors/<int:visitor_id>/qr')
@login_required
def get_visitor_qr(visitor_id):
    v = db.session.get(Visitor, visitor_id)
    if not v or not v.qr_code:
        return jsonify({'error': 'QR not found'}), 404
    qr_bytes = base64.b64decode(v.qr_code)
    return send_file(io.BytesIO(qr_bytes), mimetype='image/png')


@app.route('/api/visitors/verify-pass', methods=['POST'])
@login_required
def verify_pass():
    data = request.json
    pass_code = data.get('pass_code', '').strip().upper()
    v = Visitor.query.filter_by(pass_code=pass_code).first()
    if v and v.status == 'approved' and v.valid_until and v.valid_until > datetime.utcnow():
        return jsonify({
            'valid': True, 'visitor': {
                'id': v.id, 'name': v.name, 'phone': v.phone,
                'vehicle_number': v.vehicle_number, 'purpose': v.purpose,
                'department': v.department, 'person_to_meet': v.person_to_meet
            }
        })
    return jsonify({'valid': False, 'error': 'Invalid or expired pass'})


# ─── Scheduled Entries ────────────────────────────────────────────────────────

@app.route('/api/scheduled')
@login_required
def get_scheduled():
    entries = ScheduledEntry.query.order_by(ScheduledEntry.scheduled_time).all()
    return jsonify([{
        'id': e.id, 'visitor_name': e.visitor_name,
        'vehicle_number': e.vehicle_number, 'department': e.department,
        'scheduled_time': e.scheduled_time.isoformat(),
        'status': e.status, 'created_at': e.created_at.isoformat()
    } for e in entries])


@app.route('/api/scheduled/create', methods=['POST'])
@login_required
def create_scheduled():
    data = request.json
    e = ScheduledEntry(
        visitor_name=data['visitor_name'],
        vehicle_number=data.get('vehicle_number', ''),
        department=data.get('department', ''),
        scheduled_time=datetime.fromisoformat(data['scheduled_time'])
    )
    db.session.add(e)
    db.session.commit()
    return jsonify({'success': True, 'id': e.id})


# ─── Reports & Analytics ──────────────────────────────────────────────────────

@app.route('/reports')
@login_required
def reports_page():
    return render_template('reports.html', role=current_user.role)


@app.route('/api/reports/summary')
@login_required
def reports_summary():
    days = request.args.get('days', 7, type=int)
    since = datetime.utcnow() - timedelta(days=days)

    total = EntryLog.query.filter(EntryLog.timestamp >= since).count()
    by_direction = db.session.query(
        EntryLog.direction, db.func.count(EntryLog.id)
    ).filter(EntryLog.timestamp >= since).group_by(EntryLog.direction).all()

    by_category = db.session.query(
        EntryLog.category, db.func.count(EntryLog.id)
    ).filter(EntryLog.timestamp >= since).group_by(EntryLog.category).all()

    by_gate = db.session.query(
        EntryLog.gate_id, db.func.count(EntryLog.id)
    ).filter(EntryLog.timestamp >= since).group_by(EntryLog.gate_id).all()

    emergency_count = EntryLog.query.filter(
        EntryLog.timestamp >= since, EntryLog.is_emergency == True
    ).count()

    unauthorized = EntryLog.query.filter(
        EntryLog.timestamp >= since, EntryLog.is_authorized == False
    ).count()

    pre_reg = EntryLog.query.filter(
        EntryLog.timestamp >= since, EntryLog.is_pre_registered == True
    ).count()

    by_hour = []
    for h in range(24):
        hstart = datetime.utcnow().replace(hour=h, minute=0, second=0, microsecond=0)
        hend = hstart + timedelta(hours=1)
        cnt = EntryLog.query.filter(
            EntryLog.timestamp >= hstart, EntryLog.timestamp < hend
        ).count()
        by_hour.append({'hour': f'{h:02d}:00', 'count': cnt})

    return jsonify({
        'total': total, 'by_direction': dict(by_direction),
        'by_category': dict(by_category),
        'by_gate': {str(k): v for k, v in by_gate},
        'emergency_count': emergency_count,
        'unauthorized': unauthorized,
        'pre_registered': pre_reg,
        'by_hour': by_hour
    })


@app.route('/api/reports/export')
@login_required
def export_report():
    days = request.args.get('days', 7, type=int)
    since = datetime.utcnow() - timedelta(days=days)
    logs = EntryLog.query.filter(EntryLog.timestamp >= since).order_by(EntryLog.timestamp.desc()).all()

    lines = ['ID,Visitor,Vehicle,Plate,Direction,Category,Emergency,Authorized,Gate,Timestamp']
    for l in logs:
        gname = db.session.get(Gate, l.gate_id).name if db.session.get(Gate, l.gate_id) else 'N/A'
        lines.append(f'{l.id},"{l.visitor_name}","{l.vehicle_number or ""}","{l.number_plate or ""}",{l.direction},{l.category},{l.is_emergency},{l.is_authorized},{gname},{l.timestamp.isoformat()}')
    csv_data = '\n'.join(lines)
    return send_file(
        io.BytesIO(csv_data.encode('utf-8-sig')),
        mimetype='text/csv',
        as_attachment=True,
        download_name=f'hospital_gate_report_{datetime.now().strftime("%Y%m%d")}.csv'
    )


# ─── Alerts / Notifications ───────────────────────────────────────────────────

@app.route('/alerts')
@login_required
def alerts_page():
    return render_template('alerts.html', role=current_user.role)


@app.route('/api/alerts')
@login_required
def get_alerts():
    alerts = Alert.query.order_by(Alert.created_at.desc()).limit(100).all()
    return jsonify([{
        'id': a.id, 'type': a.type, 'message': a.message,
        'severity': a.severity, 'is_read': a.is_read,
        'created_at': a.created_at.isoformat()
    } for a in alerts])


@app.route('/api/alerts/<int:alert_id>/read', methods=['POST'])
@login_required
def mark_alert_read(alert_id):
    alert = db.session.get(Alert, alert_id)
    if not alert:
        return jsonify({'error': 'Alert not found'}), 404
    alert.is_read = True
    db.session.commit()
    return jsonify({'success': True})


@app.route('/api/alerts/read-all', methods=['POST'])
@login_required
def read_all_alerts():
    Alert.query.filter_by(is_read=False).update({'is_read': True})
    db.session.commit()
    return jsonify({'success': True})


@app.route('/api/alerts/unread-count')
@login_required
def unread_alert_count():
    count = Alert.query.filter_by(is_read=False).count()
    return jsonify({'count': count})


# ─── User Management (Admin) ──────────────────────────────────────────────────

@app.route('/users')
@login_required
@admin_required
def users_page():
    return render_template('users.html', role=current_user.role)


@app.route('/api/users')
@login_required
@admin_required
def get_users():
    users = User.query.all()
    return jsonify([{
        'id': u.id, 'username': u.username, 'role': u.role,
        'full_name': u.full_name, 'phone': u.phone, 'email': u.email,
        'is_active': u.is_active
    } for u in users])


@app.route('/api/users/create', methods=['POST'])
@login_required
@admin_required
def create_user():
    data = request.json
    if User.query.filter_by(username=data['username']).first():
        return jsonify({'error': 'Username exists'}), 400
    u = User(
        username=data['username'], role=data.get('role', 'guard'),
        full_name=data['full_name'], phone=data.get('phone', ''),
        email=data.get('email', '')
    )
    u.set_password(data['password'])
    db.session.add(u)
    db.session.commit()
    return jsonify({'success': True, 'id': u.id})


# ─── Settings / System Health ─────────────────────────────────────────────────

@app.route('/settings')
@login_required
@admin_required
def settings_page():
    return render_template('settings.html', role=current_user.role)


@app.route('/api/system/health')
@login_required
def system_health():
    return jsonify({
        'status': 'healthy',
        'uptime': 'N/A',
        'db_entries': EntryLog.query.count(),
        'visitors': Visitor.query.count(),
        'gates': Gate.query.count(),
        'alerts': Alert.query.count(),
        'users': User.query.count(),
        'scheduled': ScheduledEntry.query.count()
    })


@app.route('/api/system/clear-data', methods=['POST'])
@login_required
@admin_required
def clear_data():
    days = request.json.get('older_than_days', 90)
    cutoff = datetime.utcnow() - timedelta(days=days)
    deleted = EntryLog.query.filter(EntryLog.timestamp < cutoff).delete()
    Alert.query.filter(Alert.created_at < cutoff).delete()
    db.session.commit()
    return jsonify({'success': True, 'deleted_logs': deleted})


# ─── Main ─────────────────────────────────────────────────────────────────────

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)
