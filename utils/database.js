const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const bcrypt = require('bcryptjs');

class Database {
    constructor() {
        this.dbPath = path.join(__dirname, '..', process.env.DATABASE_PATH || './database/edutech.sqlite');
        this.db = null;
    }

    connect() {
        return new Promise((resolve, reject) => {
            this.db = new sqlite3.Database(this.dbPath, (err) => {
                if (err) {
                    console.error('Database connection error:', err);
                    reject(err);
                } else {
                    console.log('📊 Connected to SQLite database');
                    resolve(this.db);
                }
            });
        });
    }

    initializeDatabase() {
        this.connect().then(() => {
            this.createTables().then(() => {
                this.seedInitialData();
            });
        });
    }

    createTables() {
        return new Promise((resolve, reject) => {
            const queries = [
                `CREATE TABLE IF NOT EXISTS users (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    email VARCHAR(255) UNIQUE NOT NULL,
                    password_hash VARCHAR(255) NOT NULL,
                    full_name VARCHAR(255),
                    role VARCHAR(50) DEFAULT 'user',
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )`,

                `CREATE TABLE IF NOT EXISTS courses (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    title VARCHAR(255) NOT NULL,
                    description TEXT,
                    price DECIMAL(10,2) DEFAULT 0.00,
                    duration_hours INTEGER DEFAULT 0,
                    category VARCHAR(100),
                    image VARCHAR(10),
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )`,

                `CREATE TABLE IF NOT EXISTS enrollments (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id INTEGER NOT NULL,
                    course_id INTEGER NOT NULL,
                    enrolled_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    progress_percentage INTEGER DEFAULT 0,
                    completed_at DATETIME NULL,
                    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
                    FOREIGN KEY (course_id) REFERENCES courses (id) ON DELETE CASCADE,
                    UNIQUE(user_id, course_id)
                )`,

                `CREATE TABLE IF NOT EXISTS user_logs (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id INTEGER NOT NULL,
                    log_type VARCHAR(100) NOT NULL,
                    email VARCHAR(255),
                    full_name VARCHAR(255),
                    action TEXT,
                    logged_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
                )`
            ];

            let completed = 0;
            queries.forEach(query => {
                this.db.run(query, (err) => {
                    if (err) {
                        console.error('Table creation error:', err);
                        reject(err);
                    }
                    completed++;
                    if (completed === queries.length) {
                        console.log('✅ Database tables created successfully');
                        resolve();
                    }
                });
            });
        });
    }

    async seedInitialData() {
        // Check if admin already exists
        this.db.get("SELECT COUNT(*) as count FROM users WHERE role = 'admin'", async (err, row) => {
            if (err) return console.error('Error checking admin:', err);
            
            if (row.count === 0) {
                const hashedPassword = await bcrypt.hash('password123', 12);
                
                const adminUser = {
                    email: 'admin@example.com',
                    password_hash: hashedPassword,
                    full_name: 'System Administrator',
                    role: 'admin'
                };

                this.db.run(
                    `INSERT INTO users (email, password_hash, full_name, role) VALUES (?, ?, ?, ?)`,
                    [adminUser.email, adminUser.password_hash, adminUser.full_name, adminUser.role],
                    function(err) {
                        if (err) {
                            console.error('Error creating admin user:', err);
                        } else {
                            console.log('👑 Default admin user created');
                            
                            // Log the admin creation
                            this.db.run(
                                `INSERT INTO user_logs (user_id, log_type, email, full_name, action) VALUES (?, ?, ?, ?, ?)`,
                                [this.lastID, 'ADMIN_CREATED', adminUser.email, adminUser.full_name, 'Initial admin account created']
                            );
                        }
                    }
                );

                // Seed sample courses
                const sampleCourses = [
                    {
                        title: 'Web Development Bootcamp',
                        description: 'Learn full-stack web development with modern technologies',
                        price: 299.99,
                        duration_hours: 120,
                        category: 'Web Development',
                        image: '🌐'
                    },
                    {
                        title: 'Data Science Fundamentals',
                        description: 'Python, Machine Learning, and Data Analysis',
                        price: 399.99,
                        duration_hours: 100,
                        category: 'Data Science',
                        image: '📊'
                    },
                    {
                        title: 'Mobile App Development',
                        description: 'React Native, Flutter, and iOS/Android development',
                        price: 349.99,
                        duration_hours: 90,
                        category: 'Mobile Development',
                        image: '📱'
                    }
                ];

                sampleCourses.forEach(course => {
                    this.db.run(
                        `INSERT INTO courses (title, description, price, duration_hours, category, image) VALUES (?, ?, ?, ?, ?, ?)`,
                        [course.title, course.description, course.price, course.duration_hours, course.category, course.image]
                    );
                });

                console.log('📚 Sample courses added');
            }
        });
    }

    // Generic query method
    query(sql, params = []) {
        return new Promise((resolve, reject) => {
            this.db.all(sql, params, (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });
    }

    // Get single row
    get(sql, params = []) {
        return new Promise((resolve, reject) => {
            this.db.get(sql, params, (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });
    }

    // Run INSERT, UPDATE, DELETE
    run(sql, params = []) {
        return new Promise((resolve, reject) => {
            this.db.run(sql, params, function(err) {
                if (err) reject(err);
                else resolve({ id: this.lastID, changes: this.changes });
            });
        });
    }
}

module.exports = new Database();
