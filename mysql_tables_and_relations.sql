-- ============================================================
-- MediTrack MySQL Database Dump (Schema, Relations & Data)
-- Generated for MySQL 5.7+ / MySQL 8.0+ / MariaDB
-- Target Database: `meditrack`
-- ============================================================

CREATE DATABASE IF NOT EXISTS `meditrack`
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;
USE `meditrack`;

SET @OLD_FOREIGN_KEY_CHECKS = @@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS = 0;
SET @OLD_SQL_MODE = @@SQL_MODE, SQL_MODE = 'NO_AUTO_VALUE_ON_ZERO';
SET NAMES utf8mb4;

-- ============================================================
-- 1. TABLE DEFINITIONS & RELATIONSHIPS
-- ============================================================

-- Table: departments
DROP TABLE IF EXISTS `departments`;
CREATE TABLE `departments` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `name` VARCHAR(255) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table: product_types
DROP TABLE IF EXISTS `product_types`;
CREATE TABLE `product_types` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `name` VARCHAR(255) NOT NULL UNIQUE,
  `image_url` VARCHAR(500) NULL,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table: users
DROP TABLE IF EXISTS `users`;
CREATE TABLE `users` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `username` VARCHAR(100) NOT NULL UNIQUE,
  `password_hash` VARCHAR(255) NOT NULL,
  `role` ENUM('Manager', 'Senior Doctor', 'Staff') NOT NULL,
  `department_id` INT NULL,
  `is_active` BOOLEAN DEFAULT TRUE,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT `fk_users_department`
    FOREIGN KEY (`department_id`) REFERENCES `departments` (`id`)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table: equipment
DROP TABLE IF EXISTS `equipment`;
CREATE TABLE `equipment` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `qr_code_id` VARCHAR(100) NOT NULL UNIQUE,
  `name` VARCHAR(255) NOT NULL,
  `department_id` INT NULL,
  `product_type_id` INT NULL,
  `status` ENUM('Available', 'In Use') DEFAULT 'Available',
  `condition` ENUM('Usable', 'Needs Maintenance', 'Out of Order') DEFAULT 'Usable',
  `held_by` VARCHAR(255) NULL,
  `in_use_since` DATETIME NULL,
  CONSTRAINT `fk_equipment_department`
    FOREIGN KEY (`department_id`) REFERENCES `departments` (`id`)
    ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_equipment_product_type`
    FOREIGN KEY (`product_type_id`) REFERENCES `product_types` (`id`)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table: requests
DROP TABLE IF EXISTS `requests`;
CREATE TABLE `requests` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `equipment_id` INT NULL,
  `requested_by` VARCHAR(100) NOT NULL,
  `priority` ENUM('Normal', 'Urgent') DEFAULT 'Normal',
  `status` ENUM('Pending', 'Approved', 'Rejected') DEFAULT 'Pending',
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT `fk_requests_equipment`
    FOREIGN KEY (`equipment_id`) REFERENCES `equipment` (`id`)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table: audit_log
DROP TABLE IF EXISTS `audit_log`;
CREATE TABLE `audit_log` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `equipment_id` INT NULL,
  `action` VARCHAR(100) NOT NULL,
  `performed_by` VARCHAR(100) NOT NULL,
  `room` VARCHAR(100) NULL,
  `timestamp` DATETIME DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT `fk_audit_log_equipment`
    FOREIGN KEY (`equipment_id`) REFERENCES `equipment` (`id`)
    ON DELETE SET NULL ON UPDATE CASCADE,
  INDEX `idx_audit_log_equipment` (`equipment_id`),
  INDEX `idx_audit_log_timestamp` (`timestamp`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table: ai_insights
DROP TABLE IF EXISTS `ai_insights`;
CREATE TABLE `ai_insights` (
  `id` BIGINT AUTO_INCREMENT PRIMARY KEY,
  `insight_date` DATE NOT NULL,
  `type` ENUM('morning_brief', 'forgotten_equipment', 'rebalancing') NOT NULL,
  `department_id` INT NULL,
  `title` VARCHAR(255) NULL,
  `summary` TEXT NULL,
  `data` JSON NOT NULL,
  `model` VARCHAR(100) NULL,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT `fk_ai_insights_department`
    FOREIGN KEY (`department_id`) REFERENCES `departments` (`id`)
    ON DELETE SET NULL ON UPDATE CASCADE,
  INDEX `idx_ai_insights_type_date` (`type`, `insight_date`, `created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table: ai_run_log
DROP TABLE IF EXISTS `ai_run_log`;
CREATE TABLE `ai_run_log` (
  `id` BIGINT AUTO_INCREMENT PRIMARY KEY,
  `run_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `type` VARCHAR(100) NULL,
  `provider` VARCHAR(100) NULL,
  `model` VARCHAR(100) NULL,
  `attempt` INT NULL,
  `outcome` VARCHAR(50) NULL,
  `http_status` INT NULL,
  `error_category` VARCHAR(100) NULL,
  `error_message` TEXT NULL,
  `latency_ms` INT NULL,
  `prompt_chars` INT NULL,
  `est_tokens` INT NULL,
  INDEX `idx_ai_run_log_run_at` (`run_at`),
  INDEX `idx_ai_run_log_type_run_at` (`type`, `run_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table: ai_weekly_reports
DROP TABLE IF EXISTS `ai_weekly_reports`;
CREATE TABLE `ai_weekly_reports` (
  `id` BIGINT AUTO_INCREMENT PRIMARY KEY,
  `status` ENUM('queued', 'running', 'done', 'partial', 'failed') NOT NULL DEFAULT 'queued',
  `requested_by` VARCHAR(100) NOT NULL,
  `requested_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `started_at` DATETIME NULL,
  `finished_at` DATETIME NULL,
  `week_start` DATE NULL,
  `week_end` DATE NULL,
  `steps_total` INT DEFAULT 0,
  `steps_done` INT DEFAULT 0,
  `current_step` VARCHAR(255) NULL,
  `result` JSON NOT NULL,
  `model` VARCHAR(100) NULL,
  `error` TEXT NULL,
  `input_hash` VARCHAR(255) NULL,
  INDEX `idx_ai_weekly_reports_requested_at` (`requested_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================

-- ============================================================
-- RESTORE ENVIRONMENT
-- ============================================================
SET FOREIGN_KEY_CHECKS = @OLD_FOREIGN_KEY_CHECKS;
SET SQL_MODE = @OLD_SQL_MODE;
