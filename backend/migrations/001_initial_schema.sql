-- Create database if not exists
CREATE DATABASE IF NOT EXISTS healthcare;
USE healthcare;

-- Create families table
CREATE TABLE IF NOT EXISTS families (
    id INT AUTO_INCREMENT PRIMARY KEY,
    family_name VARCHAR(100) NOT NULL UNIQUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Create members table
CREATE TABLE IF NOT EXISTS members (
    id INT AUTO_INCREMENT PRIMARY KEY,
    family_id INT NOT NULL,
    name VARCHAR(100) NOT NULL,
    role VARCHAR(50) NOT NULL,
    age INT,
    face_encoding LONGBLOB,
    face_image_path VARCHAR(255),
    medical_history TEXT,
    emergency_contact VARCHAR(20),
    latitude DECIMAL(10,8) NULL,
    longitude DECIMAL(11,8) NULL,
    last_seen TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (family_id) REFERENCES families(id) ON DELETE CASCADE,
    INDEX idx_family (family_id),
    INDEX idx_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Create conversations table
CREATE TABLE IF NOT EXISTS conversations (
    id INT AUTO_INCREMENT PRIMARY KEY,
    member_id INT NOT NULL,
    message TEXT NOT NULL,
    response TEXT,
    emotion VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE CASCADE,
    INDEX idx_member (member_id),
    INDEX idx_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Create member summaries table for long-term AI context
CREATE TABLE IF NOT EXISTS member_summaries (
    member_id INT PRIMARY KEY,
    summary TEXT,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Create medications table
CREATE TABLE IF NOT EXISTS medications (
    id INT AUTO_INCREMENT PRIMARY KEY,
    member_id INT NOT NULL,
    name VARCHAR(150) NOT NULL,
    dosage VARCHAR(150) NOT NULL,
    frequency VARCHAR(100) NOT NULL,
    times JSON NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NULL,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE CASCADE,
    INDEX idx_member_medications (member_id),
    INDEX idx_medication_dates (start_date, end_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Create medication_logs table
CREATE TABLE IF NOT EXISTS medication_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    medication_id INT NOT NULL,
    taken_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    status ENUM('pending', 'triggered', 'snoozed', 'taken', 'missed', 'cancelled') NOT NULL,
    snoozed_until DATETIME NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (medication_id) REFERENCES medications(id) ON DELETE CASCADE,
    INDEX idx_medication_logs (medication_id, taken_at),
    INDEX idx_medication_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Create face_metrics table
CREATE TABLE IF NOT EXISTS face_metrics (
    id INT AUTO_INCREMENT PRIMARY KEY,
    member_id INT NOT NULL,
    recognition_attempts INT DEFAULT 0,
    successful_recognitions INT DEFAULT 0,
    average_confidence DECIMAL(5,4) DEFAULT 0,
    last_recognition TIMESTAMP NULL,
    face_quality_score DECIMAL(5,2) DEFAULT 0,
    FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE CASCADE,
    INDEX idx_member_metrics (member_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
