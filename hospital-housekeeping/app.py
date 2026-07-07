import os
from datetime import datetime, date, timedelta
from functools import wraps

from flask import (
    Flask, render_template, request, jsonify, session,
    redirect, url_for
)
from flask_sqlalchemy import SQLAlchemy
from flask_login import LoginManager, UserMixin, login_user, logout_user, login_required, current_user
from flask_bcrypt import Bcrypt

app = Flask(__name__)
app.config['SECRET_KEY'] = 'hospital-housekeeping-secure-key-2026'
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///hospital_housekeeping.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

db = SQLAlchemy(app)
bcrypt = Bcrypt(app)
login_manager = LoginManager(app)
login_manager.login_view = 'login'

# ─── Models ───────────────────────────────────────────────────────────────────

class User(db.Model, UserMixin):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    password_hash = db.Column(db.String(200), nullable=False)
    role = db.Column(db.String(20), nullable=False, default='employee')
    full_name = db.Column(db.String(100), nullable=False)
    phone = db.Column(db.String(20))
    email = db.Column(db.String(100))
    assigned_floor_id = db.Column(db.Integer, db.ForeignKey('floor.id'), nullable=True)
    is_active = db.Column(db.Boolean, default=True)

    def set_password(self, password):
        self.password_hash = bcrypt.generate_password_hash(password).decode('utf-8')

    def check_password(self, password):
        return bcrypt.check_password_hash(self.password_hash, password)


class Floor(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    code = db.Column(db.String(20), unique=True, nullable=False)
    description = db.Column(db.String(200))
    areas = db.relationship('Area', backref='floor', lazy=True)
    employees = db.relationship('User', backref='assigned_floor', lazy=True)
    inventory = db.relationship('FloorInventory', backref='floor', lazy=True)


class Area(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    floor_id = db.Column(db.Integer, db.ForeignKey('floor.id'), nullable=False)
    area_type = db.Column(db.String(50), nullable=False)
    description = db.Column(db.String(200))
    housekeeping_logs = db.relationship('HousekeepingLog', backref='area', lazy=True)


class HousekeepingTask(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    description = db.Column(db.String(300))
    frequency = db.Column(db.String(20), nullable=False, default='daily')
    area_type = db.Column(db.String(50))
    category = db.Column(db.String(50))
    is_active = db.Column(db.Boolean, default=True)
    logs = db.relationship('HousekeepingLog', backref='task', lazy=True)


class HousekeepingLog(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    task_id = db.Column(db.Integer, db.ForeignKey('housekeeping_task.id'), nullable=False)
    area_id = db.Column(db.Integer, db.ForeignKey('area.id'), nullable=False)
    floor_id = db.Column(db.Integer, db.ForeignKey('floor.id'), nullable=False)
    employee_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    status = db.Column(db.String(20), nullable=False, default='pending')
    notes = db.Column(db.String(500))
    completed_at = db.Column(db.DateTime)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    verified_by = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=True)

    employee = db.relationship('User', foreign_keys=[employee_id])
    verifier = db.relationship('User', foreign_keys=[verified_by])
    floor_rel = db.relationship('Floor', foreign_keys=[floor_id])


class Material(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    category = db.Column(db.String(50))
    unit = db.Column(db.String(20))
    sku = db.Column(db.String(50), unique=True)
    min_stock = db.Column(db.Float, default=0)
    current_stock = db.Column(db.Float, default=0)
    price = db.Column(db.Float, default=0)
    supplier = db.Column(db.String(100))
    is_active = db.Column(db.Boolean, default=True)


class FloorInventory(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    floor_id = db.Column(db.Integer, db.ForeignKey('floor.id'), nullable=False)
    material_id = db.Column(db.Integer, db.ForeignKey('material.id'), nullable=False)
    quantity = db.Column(db.Float, default=0)
    min_stock = db.Column(db.Float, default=0)

    material = db.relationship('Material')


class MaterialRequest(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    employee_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    floor_id = db.Column(db.Integer, db.ForeignKey('floor.id'), nullable=False)
    material_id = db.Column(db.Integer, db.ForeignKey('material.id'), nullable=False)
    quantity_requested = db.Column(db.Float, nullable=False)
    quantity_approved = db.Column(db.Float, default=0)
    status = db.Column(db.String(20), default='pending')
    requested_at = db.Column(db.DateTime, default=datetime.utcnow)
    approved_by = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=True)
    fulfilled_at = db.Column(db.DateTime)
    notes = db.Column(db.String(300))

    employee = db.relationship('User', foreign_keys=[employee_id])
    approver = db.relationship('User', foreign_keys=[approved_by])
    floor_rel = db.relationship('Floor', foreign_keys=[floor_id])
    material = db.relationship('Material')


class MaterialTransfer(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    material_id = db.Column(db.Integer, db.ForeignKey('material.id'), nullable=False)
    from_floor_id = db.Column(db.Integer, db.ForeignKey('floor.id'), nullable=True)
    to_floor_id = db.Column(db.Integer, db.ForeignKey('floor.id'), nullable=False)
    quantity = db.Column(db.Float, nullable=False)
    transferred_by = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    transferred_at = db.Column(db.DateTime, default=datetime.utcnow)
    notes = db.Column(db.String(300))

    material = db.relationship('Material')
    from_floor = db.relationship('Floor', foreign_keys=[from_floor_id])
    to_floor = db.relationship('Floor', foreign_keys=[to_floor_id])
    transferrer = db.relationship('User', foreign_keys=[transferred_by])


# ─── Helpers ──────────────────────────────────────────────────────────────────

def admin_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        if not current_user.is_authenticated or current_user.role not in ('admin', 'storekeeper'):
            return jsonify({'error': 'Admin/storekeeper access required'}), 403
        return f(*args, **kwargs)
    return decorated


def storekeeper_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        if not current_user.is_authenticated or current_user.role not in ('admin', 'storekeeper'):
            return jsonify({'error': 'Storekeeper access required'}), 403
        return f(*args, **kwargs)
    return decorated


def admin_only(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        if not current_user.is_authenticated or current_user.role != 'admin':
            return jsonify({'error': 'Admin access required'}), 403
        return f(*args, **kwargs)
    return decorated


# ─── Seed Data ────────────────────────────────────────────────────────────────

def seed_data():
    if User.query.count() == 0:
        admin = User(username='admin', role='admin', full_name='System Admin')
        admin.set_password('admin123')
        db.session.add(admin)

        store = User(username='store', role='storekeeper', full_name='Store Keeper')
        store.set_password('store123')
        db.session.add(store)

        emp1 = User(username='emp1', role='employee', full_name='Ravi Kumar')
        emp1.set_password('emp123')
        db.session.add(emp1)

        emp2 = User(username='emp2', role='employee', full_name='Sita Sharma')
        emp2.set_password('emp123')
        db.session.add(emp2)

    if Floor.query.count() == 0:
        floors = [
            Floor(name='Ground Floor', code='GF', description='Emergency, Reception, OPD'),
            Floor(name='First Floor', code='FF', description='ICU, Surgery, OT Complex'),
            Floor(name='Second Floor', code='SF', description='General Wards, Maternity'),
            Floor(name='Third Floor', code='TF', description='Private Rooms, VIP Suites'),
            Floor(name='Fourth Floor', code='FOF', description='Administration, Labs'),
        ]
        for f in floors:
            db.session.add(f)
        db.session.flush()

        areas_data = [
            # Ground Floor
            ('Emergency Room', floors[0].id, 'emergency', 'Main emergency treatment area'),
            ('Reception', floors[0].id, 'reception', 'Main hospital reception'),
            ('OPD Waiting Area', floors[0].id, 'waiting', 'Outpatient waiting area'),
            ('OPD Consultation Rooms', floors[0].id, 'consultation', 'Doctor consultation rooms'),
            ('Pharmacy', floors[0].id, 'pharmacy', 'Hospital pharmacy'),
            ('Main Corridor GF', floors[0].id, 'corridor', 'Ground floor main corridor'),
            ('Public Toilets GF', floors[0].id, 'toilet', 'Ground floor public toilets'),
            ('Staff Room GF', floors[0].id, 'staffroom', 'Ground floor staff room'),
            ('Cafeteria', floors[0].id, 'cafeteria', 'Hospital cafeteria'),
            ('Ambulance Bay', floors[0].id, 'entrance', 'Ambulance entrance area'),
            # First Floor
            ('ICU - Ward A', floors[1].id, 'icu', 'Intensive Care Unit A'),
            ('ICU - Ward B', floors[1].id, 'icu', 'Intensive Care Unit B'),
            ('OT - Theatre 1', floors[1].id, 'ot', 'Operation Theatre 1'),
            ('OT - Theatre 2', floors[1].id, 'ot', 'Operation Theatre 2'),
            ('OT Preparation Area', floors[1].id, 'preparation', 'Pre-operative preparation'),
            ('OT Recovery Room', floors[1].id, 'recovery', 'Post-operative recovery'),
            ('NICU', floors[1].id, 'nicu', 'Neonatal ICU'),
            ('Staff Room FF', floors[1].id, 'staffroom', 'First floor staff room'),
            ('Corridor FF', floors[1].id, 'corridor', 'First floor corridor'),
            ('Toilets FF', floors[1].id, 'toilet', 'First floor toilets'),
            # Second Floor
            ('General Ward - Male', floors[2].id, 'ward', 'Male general ward'),
            ('General Ward - Female', floors[2].id, 'ward', 'Female general ward'),
            ('Maternity Ward', floors[2].id, 'maternity', 'Maternity ward'),
            ('Labor Room', floors[2].id, 'labor', 'Delivery room'),
            ('Nursery', floors[2].id, 'nursery', 'Newborn nursery'),
            ('Pediatric Ward', floors[2].id, 'pediatric', 'Children ward'),
            ('Nurses Station SF', floors[2].id, 'nursestation', 'Second floor nurses station'),
            ('Corridor SF', floors[2].id, 'corridor', 'Second floor corridor'),
            ('Toilets SF', floors[2].id, 'toilet', 'Second floor toilets'),
            ('Dining Area', floors[2].id, 'dining', 'Patient dining area'),
            # Third Floor
            ('Private Room 301', floors[3].id, 'private', 'Private room 301'),
            ('Private Room 302', floors[3].id, 'private', 'Private room 302'),
            ('Private Room 303', floors[3].id, 'private', 'Private room 303'),
            ('VIP Suite 1', floors[3].id, 'vip', 'VIP suite 1'),
            ('VIP Suite 2', floors[3].id, 'vip', 'VIP suite 2'),
            ('Nurses Station TF', floors[3].id, 'nursestation', 'Third floor nurses station'),
            ('Corridor TF', floors[3].id, 'corridor', 'Third floor corridor'),
            ('Toilets TF', floors[3].id, 'toilet', 'Third floor toilets'),
            ('Visitor Lounge', floors[3].id, 'lounge', 'Third floor visitor lounge'),
            # Fourth Floor
            ('Laboratory', floors[4].id, 'lab', 'Diagnostic laboratory'),
            ('Blood Bank', floors[4].id, 'bloodbank', 'Blood bank'),
            ('Admin Office', floors[4].id, 'office', 'Administration office'),
            ('Meeting Room', floors[4].id, 'meeting', 'Conference room'),
            ('Store Room', floors[4].id, 'storage', 'General storage'),
            ('Staff Room FOF', floors[4].id, 'staffroom', 'Fourth floor staff room'),
            ('Corridor FOF', floors[4].id, 'corridor', 'Fourth floor corridor'),
            ('Toilets FOF', floors[4].id, 'toilet', 'Fourth floor toilets'),
        ]
        for name, fid, atype, desc in areas_data:
            db.session.add(Area(name=name, floor_id=fid, area_type=atype, description=desc))
        db.session.flush()

    if HousekeepingTask.query.count() == 0:
        tasks = [
            ('Mop and disinfect floors', 'Sweep, mop and disinfect all floor surfaces', 'daily', None, 'floor_cleaning'),
            ('Empty trash bins', 'Remove trash, replace liners in all bins', 'daily', None, 'waste'),
            ('Clean and disinfect surfaces', 'Wipe down all horizontal surfaces with disinfectant', 'daily', None, 'surface'),
            ('Clean and disinfect door handles', 'Wipe all door handles and push plates', 'daily', None, 'high_touch'),
            ('Clean and disinfect light switches', 'Wipe all light switches and switchboards', 'daily', None, 'high_touch'),
            ('Clean and disinfect handrails', 'Wipe all handrails and grab bars', 'daily', None, 'high_touch'),
            ('Restock hand sanitizer', 'Refill hand sanitizer dispensers', 'daily', None, 'sanitization'),
            ('Restock soap dispensers', 'Refill liquid soap dispensers', 'daily', None, 'sanitization'),
            ('Restock paper towels', 'Refill paper towel dispensers', 'daily', None, 'sanitization'),
            ('Restock toilet paper', 'Refill toilet paper holders in all toilets', 'daily', None, 'sanitization'),
            ('Clean and disinfect toilets', 'Scrub and disinfect all toilet fixtures', 'daily', 'toilet', 'sanitization'),
            ('Clean mirrors', 'Clean all mirrors to streak-free shine', 'daily', 'toilet', 'surface'),
            ('Dust furniture and fixtures', 'Dust all furniture, shelves, and fixtures', 'daily', None, 'dusting'),
            ('Clean windows and sills', 'Clean interior windowsills and glass', 'daily', None, 'glass'),
            ('Check and restock PPE bins', 'Ensure PPE bins have masks, gloves, caps', 'daily', None, 'ppe'),
            ('Wipe medical equipment surfaces', 'Clean exterior surfaces of medical equipment', 'daily', None, 'medical'),
            ('Clean patient bed frames', 'Wipe down bed frames and side rails', 'daily', 'ward', 'patient_area'),
            ('Make patient beds', 'Change linens and make beds with fresh sheets', 'daily', 'ward', 'patient_area'),
            ('Clean bedside tables', 'Wipe and disinfect bedside tables', 'daily', 'ward', 'patient_area'),
            ('Clean IV poles', 'Wipe down IV poles and stands', 'daily', None, 'medical'),
            ('Spot clean walls', 'Remove marks and spots from walls', 'weekly', None, 'walls'),
            ('Deep clean toilets', 'Deep scrub toilets, tiles, and grout', 'weekly', 'toilet', 'deep_cleaning'),
            ('Clean air vents', 'Vacuum and wipe air conditioning vents', 'weekly', None, 'hvac'),
            ('Wash curtains and blinds', 'Clean window curtains and blinds', 'monthly', None, 'fabric'),
            ('Shampoo carpets', 'Deep shampoo carpets in waiting areas', 'monthly', None, 'deep_cleaning'),
            ('Strip and wax floors', 'Strip old wax, apply new floor wax', 'quarterly', None, 'deep_cleaning'),
            ('Clean overhead lights', 'Clean light fixtures and replace bulbs', 'monthly', None, 'hvac'),
            ('Disinfect patient call buttons', 'Clean patient call bell/pendant', 'daily', 'ward', 'high_touch'),
            ('Clean oxygen outlets', 'Wipe oxygen and suction wall outlets', 'daily', None, 'medical'),
            ('Sanitize mattresses', 'Spray and wipe patient mattresses', 'weekly', None, 'patient_area'),
            ('Clean stretchers and wheelchairs', 'Disinfect all stretchers and wheelchairs', 'daily', None, 'equipment'),
            ('Clean staff lockers', 'Wipe down staff locker exteriors', 'weekly', 'staffroom', 'staff_area'),
            ('Empty sharp containers', 'Dispose of full sharps containers per protocol', 'weekly', None, 'waste'),
            ('Clean nursery cribs', 'Disinfect all nursery cribs and changing tables', 'daily', 'nursery', 'patient_area'),
            ('Clean OT lights', 'Clean surgical lights in operation theatres', 'weekly', 'ot', 'medical'),
            ('Mop OT floors', 'Mop OT floors with disinfectant', 'daily', 'ot', 'floor_cleaning'),
            ('Clean ICU isolation rooms', 'Disinfect isolation rooms per protocol', 'daily', 'icu', 'isolation'),
            ('Clean laboratory benches', 'Wipe lab benches and workstations', 'daily', 'lab', 'lab_area'),
            ('Clean pharmacy counters', 'Wipe pharmacy dispensing counters', 'daily', 'pharmacy', 'pharmacy_area'),
            ('Clean cafeteria tables', 'Wipe cafeteria tables and chairs', 'daily', 'cafeteria', 'dining_area'),
            ('Sweep entrance walkways', 'Sweep and clean entrance and walkways', 'daily', 'entrance', 'entrance'),
        ]
        for name, desc, freq, atype, cat in tasks:
            db.session.add(HousekeepingTask(
                name=name, description=desc, frequency=freq,
                area_type=atype, category=cat
            ))

    if Material.query.count() == 0:
        materials = [
            ('Floor Disinfectant Concentrate', 'Cleaning Supplies', 'Litre', 'CLN-001', 10, 200, 180, 'CleanChem Ltd.'),
            ('Glass Cleaner', 'Cleaning Supplies', 'Bottle', 'CLN-002', 10, 100, 85, 'CleanChem Ltd.'),
            ('Hand Sanitizer 500ml', 'Sanitization', 'Bottle', 'SAN-001', 20, 150, 120, 'SafeHands Corp.'),
            ('Liquid Soap 1L', 'Sanitization', 'Bottle', 'SAN-002', 20, 100, 95, 'SafeHands Corp.'),
            ('Toilet Paper Roll', 'Sanitization', 'Roll', 'SAN-003', 100, 500, 15, 'HygienePlus'),
            ('Paper Towel Roll', 'Sanitization', 'Roll', 'SAN-004', 50, 300, 25, 'HygienePlus'),
            ('Trash Bag Large (50L)', 'Waste', 'Pack', 'WST-001', 30, 200, 40, 'WastePro Inc.'),
            ('Trash Bag Small (20L)', 'Waste', 'Pack', 'WST-002', 30, 200, 25, 'WastePro Inc.'),
            ('Disposable Gloves (Box)', 'PPE', 'Box', 'PPE-001', 20, 100, 150, 'MedSafe Supplies'),
            ('Surgical Masks (Box)', 'PPE', 'Box', 'PPE-002', 30, 200, 85, 'MedSafe Supplies'),
            ('Hair Cap (Pack)', 'PPE', 'Pack', 'PPE-003', 20, 150, 45, 'MedSafe Supplies'),
            ('Shoe Covers (Pack)', 'PPE', 'Pack', 'PPE-004', 20, 100, 55, 'MedSafe Supplies'),
            ('Microfiber Cloth (Pack)', 'Cleaning Supplies', 'Pack', 'CLN-003', 30, 200, 65, 'CleanChem Ltd.'),
            ('Mop Head (Cotton)', 'Cleaning Supplies', 'Pcs', 'CLN-004', 20, 80, 35, 'CleanChem Ltd.'),
            ('Mop Handle', 'Cleaning Supplies', 'Pcs', 'CLN-005', 10, 30, 120, 'CleanChem Ltd.'),
            ('Bucket 10L', 'Cleaning Supplies', 'Pcs', 'CLN-006', 10, 25, 160, 'CleanChem Ltd.'),
            ('Scrub Brush', 'Cleaning Supplies', 'Pcs', 'CLN-007', 10, 40, 45, 'CleanChem Ltd.'),
            ('Sponge (Pack)', 'Cleaning Supplies', 'Pack', 'CLN-008', 20, 100, 30, 'CleanChem Ltd.'),
            ('Disinfectant Wipes (Can)', 'Cleaning Supplies', 'Can', 'CLN-009', 20, 100, 95, 'CleanChem Ltd.'),
            ('Bleach 1L', 'Cleaning Supplies', 'Bottle', 'CLN-010', 10, 80, 55, 'CleanChem Ltd.'),
            ('Toilet Bowl Cleaner', 'Cleaning Supplies', 'Bottle', 'CLN-011', 10, 60, 70, 'CleanChem Ltd.'),
            ('Air Freshener', 'Sanitization', 'Can', 'SAN-005', 10, 50, 65, 'HygienePlus'),
            ('Wet Floor Sign', 'Safety', 'Pcs', 'SAF-001', 5, 15, 180, 'SafetyFirst Co.'),
            ('Biohazard Bag (Pack)', 'Waste', 'Pack', 'WST-003', 10, 80, 60, 'WastePro Inc.'),
            ('Sharps Container 5L', 'Waste', 'Pcs', 'WST-004', 10, 30, 140, 'WastePro Inc.'),
            ('Stainless Steel Polish', 'Cleaning Supplies', 'Bottle', 'CLN-012', 5, 30, 110, 'CleanChem Ltd.'),
            ('Dusting Feather', 'Cleaning Supplies', 'Pcs', 'CLN-013', 10, 20, 85, 'CleanChem Ltd.'),
            ('Floor Wax', 'Cleaning Supplies', 'Bottle', 'CLN-014', 5, 20, 220, 'CleanChem Ltd.'),
            ('Mattress Protector (Pack)', 'Linen', 'Pack', 'LIN-001', 10, 50, 180, 'LinenWorld'),
            ('Bed Sheet (Fitted)', 'Linen', 'Pcs', 'LIN-002', 30, 100, 280, 'LinenWorld'),
            ('Pillow Cover', 'Linen', 'Pcs', 'LIN-003', 30, 100, 75, 'LinenWorld'),
            ('Towels (Bath)', 'Linen', 'Pcs', 'LIN-004', 20, 100, 120, 'LinenWorld'),
            ('Curtains (Window)', 'Linen', 'Pcs', 'LIN-005', 10, 40, 350, 'LinenWorld'),
            ('Patient Gown', 'Linen', 'Pcs', 'LIN-006', 20, 80, 220, 'LinenWorld'),
        ]
        for name, cat, unit, sku, min_stk, stock, price, supp in materials:
            db.session.add(Material(
                name=name, category=cat, unit=unit, sku=sku,
                min_stock=min_stk, current_stock=stock,
                price=price, supplier=supp
            ))

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
        'phone': current_user.phone, 'email': current_user.email,
        'assigned_floor_id': current_user.assigned_floor_id
    })


# ─── Main Routes ─────────────────────────────────────────────────────────────

@app.route('/')
@login_required
def index():
    return render_template('dashboard.html', role=current_user.role)


@app.route('/housekeeping')
@login_required
def housekeeping_page():
    return render_template('housekeeping.html', role=current_user.role)


@app.route('/inventory')
@login_required
def inventory_page():
    return render_template('inventory.html', role=current_user.role)


@app.route('/floor-inventory')
@login_required
def floor_inventory_page():
    return render_template('floor_inventory.html', role=current_user.role)


@app.route('/requests')
@login_required
def requests_page():
    return render_template('requests.html', role=current_user.role)


@app.route('/transfers')
@login_required
def transfers_page():
    return render_template('transfers.html', role=current_user.role)


@app.route('/materials')
@login_required
def materials_page():
    return render_template('materials.html', role=current_user.role)


@app.route('/floors')
@login_required
def floors_page():
    return render_template('floors.html', role=current_user.role)


@app.route('/employees')
@login_required
def employees_page():
    return render_template('employees.html', role=current_user.role)


@app.route('/areas')
@login_required
def areas_page():
    return render_template('areas.html', role=current_user.role)


@app.route('/tasks')
@login_required
def tasks_page():
    return render_template('tasks.html', role=current_user.role)


# ─── API: Dashboard ──────────────────────────────────────────────────────────

@app.route('/api/dashboard/stats')
@login_required
def dashboard_stats():
    today = date.today()
    today_start = datetime(today.year, today.month, today.day)

    total_tasks = HousekeepingTask.query.filter_by(is_active=True).count()
    today_logs = HousekeepingLog.query.filter(HousekeepingLog.created_at >= today_start).count()
    today_completed = HousekeepingLog.query.filter(
        HousekeepingLog.created_at >= today_start,
        HousekeepingLog.status == 'completed'
    ).count()
    today_pending_tasks = HousekeepingLog.query.filter(
        HousekeepingLog.created_at >= today_start,
        HousekeepingLog.status == 'pending'
    ).count()

    pending_requests = MaterialRequest.query.filter_by(status='pending').count()
    total_materials = Material.query.filter_by(is_active=True).count()
    total_floors = Floor.query.count()
    total_employees = User.query.filter_by(role='employee', is_active=True).count()

    low_stock_materials = Material.query.filter(
        Material.current_stock <= Material.min_stock,
        Material.is_active == True
    ).count()

    low_stock_floor = FloorInventory.query.filter(
        FloorInventory.quantity <= FloorInventory.min_stock
    ).count()

    recent_activity = HousekeepingLog.query.order_by(HousekeepingLog.created_at.desc()).limit(5).all()

    return jsonify({
        'total_tasks': total_tasks,
        'today_logs': today_logs,
        'today_completed': today_completed,
        'today_pending_tasks': today_pending_tasks,
        'pending_requests': pending_requests,
        'total_materials': total_materials,
        'total_floors': total_floors,
        'total_employees': total_employees,
        'low_stock_materials': low_stock_materials,
        'low_stock_floor': low_stock_floor,
        'recent_activity': [{
            'id': l.id, 'task': l.task.name, 'area': l.area.name,
            'status': l.status, 'employee': l.employee.full_name,
            'time': l.created_at.isoformat()
        } for l in recent_activity]
    })


# ─── API: Floors ─────────────────────────────────────────────────────────────

@app.route('/api/floors')
@login_required
def get_floors():
    floors = Floor.query.all()
    return jsonify([{
        'id': f.id, 'name': f.name, 'code': f.code,
        'description': f.description,
        'area_count': len(f.areas),
        'employee_count': len([e for e in f.employees if e.role == 'employee'])
    } for f in floors])


@app.route('/api/floors/create', methods=['POST'])
@login_required
@admin_only
def create_floor():
    data = request.json
    if Floor.query.filter_by(code=data['code']).first():
        return jsonify({'error': 'Floor code already exists'}), 400
    f = Floor(name=data['name'], code=data['code'], description=data.get('description', ''))
    db.session.add(f)
    db.session.commit()
    return jsonify({'success': True, 'id': f.id})


@app.route('/api/floors/<int:floor_id>', methods=['PUT'])
@login_required
@admin_only
def update_floor(floor_id):
    f = db.session.get(Floor, floor_id)
    if not f:
        return jsonify({'error': 'Floor not found'}), 404
    data = request.json
    f.name = data.get('name', f.name)
    f.code = data.get('code', f.code)
    f.description = data.get('description', f.description)
    db.session.commit()
    return jsonify({'success': True})


@app.route('/api/floors/<int:floor_id>', methods=['DELETE'])
@login_required
@admin_only
def delete_floor(floor_id):
    f = db.session.get(Floor, floor_id)
    if not f:
        return jsonify({'error': 'Floor not found'}), 404
    db.session.delete(f)
    db.session.commit()
    return jsonify({'success': True})


# ─── API: Areas ──────────────────────────────────────────────────────────────

@app.route('/api/areas')
@login_required
def get_areas():
    floor_id = request.args.get('floor_id', type=int)
    query = Area.query
    if floor_id:
        query = query.filter_by(floor_id=floor_id)
    areas = query.all()
    return jsonify([{
        'id': a.id, 'name': a.name, 'floor_id': a.floor_id,
        'floor_name': a.floor.name,
        'area_type': a.area_type, 'description': a.description
    } for a in areas])


@app.route('/api/areas/create', methods=['POST'])
@login_required
@admin_only
def create_area():
    data = request.json
    a = Area(
        name=data['name'], floor_id=data['floor_id'],
        area_type=data['area_type'], description=data.get('description', '')
    )
    db.session.add(a)
    db.session.commit()
    return jsonify({'success': True, 'id': a.id})


@app.route('/api/areas/<int:area_id>', methods=['PUT'])
@login_required
@admin_only
def update_area(area_id):
    a = db.session.get(Area, area_id)
    if not a:
        return jsonify({'error': 'Area not found'}), 404
    data = request.json
    a.name = data.get('name', a.name)
    a.floor_id = data.get('floor_id', a.floor_id)
    a.area_type = data.get('area_type', a.area_type)
    a.description = data.get('description', a.description)
    db.session.commit()
    return jsonify({'success': True})


@app.route('/api/areas/<int:area_id>', methods=['DELETE'])
@login_required
@admin_only
def delete_area(area_id):
    a = db.session.get(Area, area_id)
    if not a:
        return jsonify({'error': 'Area not found'}), 404
    db.session.delete(a)
    db.session.commit()
    return jsonify({'success': True})


# ─── API: Housekeeping Tasks ─────────────────────────────────────────────────

@app.route('/api/tasks')
@login_required
def get_tasks():
    area_type = request.args.get('area_type', '')
    query = HousekeepingTask.query.filter_by(is_active=True)
    if area_type:
        query = query.filter((HousekeepingTask.area_type == area_type) | (HousekeepingTask.area_type.is_(None)))
    tasks = query.all()
    return jsonify([{
        'id': t.id, 'name': t.name, 'description': t.description,
        'frequency': t.frequency, 'area_type': t.area_type,
        'category': t.category
    } for t in tasks])


@app.route('/api/tasks/create', methods=['POST'])
@login_required
@admin_only
def create_task():
    data = request.json
    t = HousekeepingTask(
        name=data['name'], description=data.get('description', ''),
        frequency=data.get('frequency', 'daily'),
        area_type=data.get('area_type', ''),
        category=data.get('category', '')
    )
    db.session.add(t)
    db.session.commit()
    return jsonify({'success': True, 'id': t.id})


@app.route('/api/tasks/<int:task_id>', methods=['PUT'])
@login_required
@admin_only
def update_task(task_id):
    t = db.session.get(HousekeepingTask, task_id)
    if not t:
        return jsonify({'error': 'Task not found'}), 404
    data = request.json
    for field in ('name', 'description', 'frequency', 'area_type', 'category', 'is_active'):
        if field in data:
            setattr(t, field, data[field])
    db.session.commit()
    return jsonify({'success': True})


@app.route('/api/tasks/<int:task_id>', methods=['DELETE'])
@login_required
@admin_only
def delete_task(task_id):
    t = db.session.get(HousekeepingTask, task_id)
    if not t:
        return jsonify({'error': 'Task not found'}), 404
    t.is_active = False
    db.session.commit()
    return jsonify({'success': True})


@app.route('/api/area-types')
@login_required
def get_area_types():
    types = db.session.query(Area.area_type).distinct().all()
    return jsonify(sorted([t[0] for t in types]))


# ─── API: Housekeeping Logs ──────────────────────────────────────────────────

@app.route('/api/housekeeping-logs')
@login_required
def get_housekeeping_logs():
    floor_id = request.args.get('floor_id', type=int)
    area_id = request.args.get('area_id', type=int)
    status = request.args.get('status', '')
    date_from = request.args.get('date_from', '')
    date_to = request.args.get('date_to', '')
    employee_id = request.args.get('employee_id', type=int)

    query = HousekeepingLog.query

    if floor_id:
        query = query.filter_by(floor_id=floor_id)
    if area_id:
        query = query.filter_by(area_id=area_id)
    if status:
        query = query.filter_by(status=status)
    if employee_id:
        query = query.filter_by(employee_id=employee_id)
    if date_from:
        query = query.filter(HousekeepingLog.created_at >= datetime.strptime(date_from, '%Y-%m-%d'))
    if date_to:
        query = query.filter(HousekeepingLog.created_at <= datetime.strptime(date_to, '%Y-%m-%d') + timedelta(days=1))

    logs = query.order_by(HousekeepingLog.created_at.desc()).limit(100).all()
    return jsonify([{
        'id': l.id, 'task_id': l.task_id, 'task_name': l.task.name,
        'area_id': l.area_id, 'area_name': l.area.name,
        'floor_id': l.floor_id, 'floor_name': l.floor_rel.name,
        'employee_id': l.employee_id, 'employee_name': l.employee.full_name,
        'status': l.status, 'notes': l.notes or '',
        'completed_at': l.completed_at.isoformat() if l.completed_at else None,
        'created_at': l.created_at.isoformat(),
        'verified_by': l.verifier.full_name if l.verifier else None
    } for l in logs])


@app.route('/api/housekeeping-logs/generate', methods=['POST'])
@login_required
@admin_only
def generate_daily_logs():
    data = request.json
    floor_id = data.get('floor_id')
    employee_id = data.get('employee_id')

    if not floor_id:
        return jsonify({'error': 'Floor is required'}), 400

    areas = Area.query.filter_by(floor_id=floor_id).all()
    tasks = HousekeepingTask.query.filter_by(is_active=True).all()

    today_start = datetime.combine(date.today(), datetime.min.time())
    count = 0

    for area in areas:
        for task in tasks:
            if task.area_type and task.area_type != area.area_type:
                continue
            existing = HousekeepingLog.query.filter(
                HousekeepingLog.task_id == task.id,
                HousekeepingLog.area_id == area.id,
                HousekeepingLog.created_at >= today_start
            ).first()
            if existing:
                continue
            log = HousekeepingLog(
                task_id=task.id,
                area_id=area.id,
                floor_id=floor_id,
                employee_id=employee_id or current_user.id,
                status='pending'
            )
            db.session.add(log)
            count += 1

    db.session.commit()
    return jsonify({'success': True, 'count': count})


@app.route('/api/housekeeping-logs/<int:log_id>/complete', methods=['POST'])
@login_required
def complete_housekeeping_log(log_id):
    log = db.session.get(HousekeepingLog, log_id)
    if not log:
        return jsonify({'error': 'Log not found'}), 404

    if current_user.role != 'admin' and log.employee_id != current_user.id:
        return jsonify({'error': 'Not authorized'}), 403

    data = request.json
    log.status = 'completed'
    log.completed_at = datetime.utcnow()
    log.notes = data.get('notes', log.notes or '')
    if current_user.role in ('admin', 'storekeeper'):
        log.verified_by = current_user.id
    db.session.commit()
    return jsonify({'success': True})


@app.route('/api/housekeeping-logs/<int:log_id>/fail', methods=['POST'])
@login_required
def fail_housekeeping_log(log_id):
    log = db.session.get(HousekeepingLog, log_id)
    if not log:
        return jsonify({'error': 'Log not found'}), 404

    if current_user.role != 'admin' and log.employee_id != current_user.id:
        return jsonify({'error': 'Not authorized'}), 403

    data = request.json
    log.status = 'incomplete'
    log.notes = data.get('notes', '')
    db.session.commit()
    return jsonify({'success': True})


@app.route('/api/housekeeping-logs/<int:log_id>/verify', methods=['POST'])
@login_required
@admin_only
def verify_housekeeping_log(log_id):
    log = db.session.get(HousekeepingLog, log_id)
    if not log:
        return jsonify({'error': 'Log not found'}), 404
    log.verified_by = current_user.id
    db.session.commit()
    return jsonify({'success': True})


@app.route('/api/housekeeping-logs/status-counts')
@login_required
def housekeeping_status_counts():
    today_start = datetime.combine(date.today(), datetime.min.time())
    floor_id = request.args.get('floor_id', type=int)

    query = HousekeepingLog.query
    if floor_id:
        query = query.filter_by(floor_id=floor_id)

    today_query = query.filter(HousekeepingLog.created_at >= today_start)
    total = today_query.count()
    completed = today_query.filter_by(status='completed').count()
    pending = today_query.filter_by(status='pending').count()
    incomplete = today_query.filter_by(status='incomplete').count()

    return jsonify({
        'total': total,
        'completed': completed,
        'pending': pending,
        'incomplete': incomplete
    })


@app.route('/api/housekeeping-logs/today')
@login_required
def today_housekeeping_logs():
    today_start = datetime.combine(date.today(), datetime.min.time())
    floor_id = request.args.get('floor_id', type=int)
    area_id = request.args.get('area_id', type=int)
    status = request.args.get('status', '')

    query = HousekeepingLog.query.filter(HousekeepingLog.created_at >= today_start)

    if floor_id:
        query = query.filter_by(floor_id=floor_id)
    if area_id:
        query = query.filter_by(area_id=area_id)
    if status:
        query = query.filter_by(status=status)

    if current_user.role == 'employee':
        query = query.filter_by(employee_id=current_user.id)

    logs = query.order_by(HousekeepingLog.created_at.asc()).all()

    # Group by area
    grouped = {}
    for l in logs:
        key = (l.area_id, l.area.name)
        if key not in grouped:
            grouped[key] = {'area_id': l.area_id, 'area_name': l.area.name, 'tasks': []}
        grouped[key]['tasks'].append({
            'id': l.id, 'task_id': l.task_id, 'task_name': l.task.name,
            'task_category': l.task.category,
            'status': l.status, 'notes': l.notes or '',
            'completed_at': l.completed_at.isoformat() if l.completed_at else None,
            'employee_name': l.employee.full_name
        })

    return jsonify(list(grouped.values()))


# ─── API: Materials (Master Inventory) ───────────────────────────────────────

@app.route('/api/materials')
@login_required
def get_materials():
    materials = Material.query.filter_by(is_active=True).all()
    return jsonify([{
        'id': m.id, 'name': m.name, 'category': m.category,
        'unit': m.unit, 'sku': m.sku, 'min_stock': m.min_stock,
        'current_stock': m.current_stock, 'price': m.price,
        'supplier': m.supplier
    } for m in materials])


@app.route('/api/materials/create', methods=['POST'])
@login_required
@storekeeper_required
def create_material():
    data = request.json
    if Material.query.filter_by(sku=data['sku']).first():
        return jsonify({'error': 'SKU already exists'}), 400
    m = Material(
        name=data['name'], category=data.get('category', ''),
        unit=data.get('unit', 'Pcs'), sku=data['sku'],
        min_stock=data.get('min_stock', 0),
        current_stock=data.get('current_stock', 0),
        price=data.get('price', 0),
        supplier=data.get('supplier', '')
    )
    db.session.add(m)
    db.session.commit()
    return jsonify({'success': True, 'id': m.id})


@app.route('/api/materials/<int:material_id>', methods=['PUT'])
@login_required
@storekeeper_required
def update_material(material_id):
    m = db.session.get(Material, material_id)
    if not m:
        return jsonify({'error': 'Material not found'}), 404
    data = request.json
    for field in ('name', 'category', 'unit', 'sku', 'min_stock', 'current_stock', 'price', 'supplier'):
        if field in data:
            setattr(m, field, data[field])
    db.session.commit()
    return jsonify({'success': True})


@app.route('/api/materials/<int:material_id>', methods=['DELETE'])
@login_required
@storekeeper_required
def delete_material(material_id):
    m = db.session.get(Material, material_id)
    if not m:
        return jsonify({'error': 'Material not found'}), 404
    m.is_active = False
    db.session.commit()
    return jsonify({'success': True})


@app.route('/api/materials/low-stock')
@login_required
def low_stock_materials():
    materials = Material.query.filter(
        Material.current_stock <= Material.min_stock,
        Material.is_active == True
    ).all()
    return jsonify([{
        'id': m.id, 'name': m.name, 'category': m.category,
        'current_stock': m.current_stock, 'min_stock': m.min_stock,
        'unit': m.unit
    } for m in materials])


# ─── API: Floor Inventory ────────────────────────────────────────────────────

@app.route('/api/floor-inventory')
@login_required
def get_floor_inventory():
    floor_id = request.args.get('floor_id', type=int)
    query = FloorInventory.query
    if floor_id:
        query = query.filter_by(floor_id=floor_id)

    inv = query.all()
    return jsonify([{
        'id': i.id, 'floor_id': i.floor_id, 'floor_name': i.floor.name,
        'material_id': i.material_id, 'material_name': i.material.name,
        'material_category': i.material.category,
        'material_unit': i.material.unit,
        'quantity': i.quantity, 'min_stock': i.min_stock
    } for i in inv])


@app.route('/api/floor-inventory/setup', methods=['POST'])
@login_required
@storekeeper_required
def setup_floor_inventory():
    data = request.json
    floor_id = data.get('floor_id')
    material_ids = data.get('material_ids', [])

    if not floor_id:
        return jsonify({'error': 'Floor is required'}), 400

    count = 0
    for mid in material_ids:
        existing = FloorInventory.query.filter_by(
            floor_id=floor_id, material_id=mid
        ).first()
        if not existing:
            mat = db.session.get(Material, mid)
            if mat:
                fi = FloorInventory(
                    floor_id=floor_id,
                    material_id=mid,
                    quantity=0,
                    min_stock=mat.min_stock
                )
                db.session.add(fi)
                count += 1

    db.session.commit()
    return jsonify({'success': True, 'count': count})


@app.route('/api/floor-inventory/<int:inv_id>/adjust', methods=['POST'])
@login_required
@storekeeper_required
def adjust_floor_inventory(inv_id):
    fi = db.session.get(FloorInventory, inv_id)
    if not fi:
        return jsonify({'error': 'Inventory record not found'}), 404
    data = request.json
    fi.quantity = data.get('quantity', fi.quantity)
    fi.min_stock = data.get('min_stock', fi.min_stock)
    db.session.commit()
    return jsonify({'success': True})


# ─── API: Material Requests ──────────────────────────────────────────────────

@app.route('/api/requests')
@login_required
def get_requests():
    status = request.args.get('status', '')
    floor_id = request.args.get('floor_id', type=int)
    employee_id = request.args.get('employee_id', type=int)

    query = MaterialRequest.query
    if status:
        query = query.filter_by(status=status)
    if floor_id:
        query = query.filter_by(floor_id=floor_id)
    if employee_id:
        query = query.filter_by(employee_id=employee_id)
    if current_user.role == 'employee':
        query = query.filter_by(employee_id=current_user.id)

    reqs = query.order_by(MaterialRequest.requested_at.desc()).limit(100).all()
    return jsonify([{
        'id': r.id, 'employee_id': r.employee_id,
        'employee_name': r.employee.full_name,
        'floor_id': r.floor_id, 'floor_name': r.floor_rel.name,
        'material_id': r.material_id, 'material_name': r.material.name,
        'material_unit': r.material.unit,
        'quantity_requested': r.quantity_requested,
        'quantity_approved': r.quantity_approved,
        'status': r.status,
        'requested_at': r.requested_at.isoformat(),
        'approved_by': r.approver.full_name if r.approver else None,
        'fulfilled_at': r.fulfilled_at.isoformat() if r.fulfilled_at else None,
        'notes': r.notes or ''
    } for r in reqs])


@app.route('/api/requests/create', methods=['POST'])
@login_required
def create_request():
    data = request.json
    r = MaterialRequest(
        employee_id=current_user.id,
        floor_id=data['floor_id'],
        material_id=data['material_id'],
        quantity_requested=data['quantity_requested'],
        notes=data.get('notes', '')
    )
    db.session.add(r)
    db.session.commit()
    return jsonify({'success': True, 'id': r.id})


@app.route('/api/requests/<int:req_id>/approve', methods=['POST'])
@login_required
@storekeeper_required
def approve_request(req_id):
    r = db.session.get(MaterialRequest, req_id)
    if not r:
        return jsonify({'error': 'Request not found'}), 404
    data = request.json
    qty = data.get('quantity_approved', r.quantity_requested)
    r.status = 'approved'
    r.quantity_approved = qty
    r.approved_by = current_user.id
    db.session.commit()
    return jsonify({'success': True})


@app.route('/api/requests/<int:req_id>/reject', methods=['POST'])
@login_required
@storekeeper_required
def reject_request(req_id):
    r = db.session.get(MaterialRequest, req_id)
    if not r:
        return jsonify({'error': 'Request not found'}), 404
    r.status = 'rejected'
    r.approved_by = current_user.id
    db.session.commit()
    return jsonify({'success': True})


@app.route('/api/requests/<int:req_id>/fulfill', methods=['POST'])
@login_required
@storekeeper_required
def fulfill_request(req_id):
    r = db.session.get(MaterialRequest, req_id)
    if not r:
        return jsonify({'error': 'Request not found'}), 404
    if r.status != 'approved':
        return jsonify({'error': 'Request must be approved first'}), 400

    material = db.session.get(Material, r.material_id)
    if material.current_stock < r.quantity_approved:
        return jsonify({'error': 'Insufficient main inventory stock'}), 400

    material.current_stock -= r.quantity_approved

    floor_inv = FloorInventory.query.filter_by(
        floor_id=r.floor_id, material_id=r.material_id
    ).first()
    if floor_inv:
        floor_inv.quantity += r.quantity_approved
    else:
        floor_inv = FloorInventory(
            floor_id=r.floor_id, material_id=r.material_id,
            quantity=r.quantity_approved, min_stock=material.min_stock
        )
        db.session.add(floor_inv)

    r.status = 'fulfilled'
    r.fulfilled_at = datetime.utcnow()

    transfer = MaterialTransfer(
        material_id=r.material_id,
        from_floor_id=None,
        to_floor_id=r.floor_id,
        quantity=r.quantity_approved,
        transferred_by=current_user.id,
        notes=f'Fulfilled request #{r.id} by {r.employee.full_name}'
    )
    db.session.add(transfer)
    db.session.commit()
    return jsonify({'success': True})


@app.route('/api/requests/<int:req_id>', methods=['DELETE'])
@login_required
@admin_only
def delete_request(req_id):
    r = db.session.get(MaterialRequest, req_id)
    if not r:
        return jsonify({'error': 'Request not found'}), 404
    db.session.delete(r)
    db.session.commit()
    return jsonify({'success': True})


# ─── API: Material Transfers ─────────────────────────────────────────────────

@app.route('/api/transfers')
@login_required
def get_transfers():
    transfers = MaterialTransfer.query.order_by(
        MaterialTransfer.transferred_at.desc()
    ).limit(100).all()
    return jsonify([{
        'id': t.id, 'material_id': t.material_id,
        'material_name': t.material.name,
        'from_floor_id': t.from_floor_id,
        'from_floor_name': t.from_floor.name if t.from_floor else 'Main Store',
        'to_floor_id': t.to_floor_id,
        'to_floor_name': t.to_floor.name,
        'quantity': t.quantity,
        'transferred_by': t.transferrer.full_name,
        'transferred_at': t.transferred_at.isoformat(),
        'notes': t.notes or ''
    } for t in transfers])


@app.route('/api/transfers/create', methods=['POST'])
@login_required
@storekeeper_required
def create_transfer():
    data = request.json
    material = db.session.get(Material, data['material_id'])
    if not material:
        return jsonify({'error': 'Material not found'}), 404

    from_floor_id = data.get('from_floor_id')

    if from_floor_id:
        from_inv = FloorInventory.query.filter_by(
            floor_id=from_floor_id, material_id=data['material_id']
        ).first()
        if not from_inv or from_inv.quantity < data['quantity']:
            return jsonify({'error': 'Insufficient stock on source floor'}), 400
        from_inv.quantity -= data['quantity']
    else:
        if material.current_stock < data['quantity']:
            return jsonify({'error': 'Insufficient main store stock'}), 400
        material.current_stock -= data['quantity']

    to_inv = FloorInventory.query.filter_by(
        floor_id=data['to_floor_id'], material_id=data['material_id']
    ).first()
    if to_inv:
        to_inv.quantity += data['quantity']
    else:
        to_inv = FloorInventory(
            floor_id=data['to_floor_id'],
            material_id=data['material_id'],
            quantity=data['quantity'],
            min_stock=material.min_stock
        )
        db.session.add(to_inv)

    t = MaterialTransfer(
        material_id=data['material_id'],
        from_floor_id=from_floor_id,
        to_floor_id=data['to_floor_id'],
        quantity=data['quantity'],
        transferred_by=current_user.id,
        notes=data.get('notes', '')
    )
    db.session.add(t)
    db.session.commit()
    return jsonify({'success': True, 'id': t.id})


# ─── API: Employees (User Management) ────────────────────────────────────────

@app.route('/api/employees')
@login_required
def get_employees():
    role = request.args.get('role', '')
    query = User.query
    if role:
        query = query.filter_by(role=role)
    else:
        query = query.filter(User.role.in_(['employee', 'storekeeper']))
    users = query.all()
    return jsonify([{
        'id': u.id, 'username': u.username, 'role': u.role,
        'full_name': u.full_name, 'phone': u.phone or '',
        'email': u.email or '',
        'assigned_floor_id': u.assigned_floor_id,
        'assigned_floor_name': u.assigned_floor.name if u.assigned_floor else None,
        'is_active': u.is_active
    } for u in users])


@app.route('/api/employees/create', methods=['POST'])
@login_required
@admin_only
def create_employee():
    data = request.json
    if User.query.filter_by(username=data['username']).first():
        return jsonify({'error': 'Username already exists'}), 400
    u = User(
        username=data['username'],
        role=data.get('role', 'employee'),
        full_name=data['full_name'],
        phone=data.get('phone', ''),
        email=data.get('email', ''),
        assigned_floor_id=data.get('assigned_floor_id')
    )
    u.set_password(data['password'])
    db.session.add(u)
    db.session.commit()
    return jsonify({'success': True, 'id': u.id})


@app.route('/api/employees/<int:user_id>', methods=['PUT'])
@login_required
@admin_only
def update_employee(user_id):
    u = db.session.get(User, user_id)
    if not u:
        return jsonify({'error': 'User not found'}), 404
    data = request.json
    u.full_name = data.get('full_name', u.full_name)
    u.phone = data.get('phone', u.phone)
    u.email = data.get('email', u.email)
    u.role = data.get('role', u.role)
    u.assigned_floor_id = data.get('assigned_floor_id', u.assigned_floor_id)
    u.is_active = data.get('is_active', u.is_active)
    if data.get('password'):
        u.set_password(data['password'])
    db.session.commit()
    return jsonify({'success': True})


@app.route('/api/employees/<int:user_id>', methods=['DELETE'])
@login_required
@admin_only
def delete_employee(user_id):
    u = db.session.get(User, user_id)
    if not u:
        return jsonify({'error': 'User not found'}), 404
    u.is_active = False
    db.session.commit()
    return jsonify({'success': True})


# ─── API: Reports ────────────────────────────────────────────────────────────

@app.route('/api/reports/housekeeping')
@login_required
def report_housekeeping():
    days = request.args.get('days', 7, type=int)
    since = datetime.utcnow() - timedelta(days=days)

    logs = HousekeepingLog.query.filter(
        HousekeepingLog.created_at >= since
    ).all()

    total = len(logs)
    completed = sum(1 for l in logs if l.status == 'completed')
    incomplete = sum(1 for l in logs if l.status == 'incomplete')

    by_floor = {}
    for l in logs:
        fn = l.floor_rel.name
        if fn not in by_floor:
            by_floor[fn] = {'total': 0, 'completed': 0}
        by_floor[fn]['total'] += 1
        if l.status == 'completed':
            by_floor[fn]['completed'] += 1

    by_employee = {}
    for l in logs:
        en = l.employee.full_name
        if en not in by_employee:
            by_employee[en] = {'total': 0, 'completed': 0}
        by_employee[en]['total'] += 1
        if l.status == 'completed':
            by_employee[en]['completed'] += 1

    daily_counts = {}
    for l in logs:
        day = l.created_at.strftime('%Y-%m-%d')
        if day not in daily_counts:
            daily_counts[day] = {'total': 0, 'completed': 0}
        daily_counts[day]['total'] += 1
        if l.status == 'completed':
            daily_counts[day]['completed'] += 1

    return jsonify({
        'total': total,
        'completed': completed,
        'incomplete': incomplete,
        'completion_rate': round((completed / total * 100) if total else 0, 1),
        'by_floor': by_floor,
        'by_employee': by_employee,
        'daily_counts': daily_counts
    })


@app.route('/api/reports/inventory')
@login_required
def report_inventory():
    materials = Material.query.filter_by(is_active=True).all()
    total_value = sum(m.current_stock * m.price for m in materials)
    low_stock = sum(1 for m in materials if m.current_stock <= m.min_stock)
    total_items = len(materials)
    total_qty = sum(m.current_stock for m in materials)

    by_category = {}
    for m in materials:
        cat = m.category or 'Uncategorized'
        if cat not in by_category:
            by_category[cat] = {'count': 0, 'total_qty': 0, 'total_value': 0}
        by_category[cat]['count'] += 1
        by_category[cat]['total_qty'] += m.current_stock
        by_category[cat]['total_value'] += m.current_stock * m.price

    return jsonify({
        'total_items': total_items,
        'total_qty': total_qty,
        'total_value': total_value,
        'low_stock': low_stock,
        'by_category': by_category
    })


@app.route('/api/reports/requests')
@login_required
def report_requests():
    days = request.args.get('days', 30, type=int)
    since = datetime.utcnow() - timedelta(days=days)

    reqs = MaterialRequest.query.filter(
        MaterialRequest.requested_at >= since
    ).all()

    total = len(reqs)
    pending = sum(1 for r in reqs if r.status == 'pending')
    approved = sum(1 for r in reqs if r.status == 'approved')
    fulfilled = sum(1 for r in reqs if r.status == 'fulfilled')
    rejected = sum(1 for r in reqs if r.status == 'rejected')

    return jsonify({
        'total': total,
        'pending': pending,
        'approved': approved,
        'fulfilled': fulfilled,
        'rejected': rejected
    })


# ─── Main ────────────────────────────────────────────────────────────────────

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5001, debug=True)
