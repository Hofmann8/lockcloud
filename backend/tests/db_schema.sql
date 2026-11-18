-- 由 tests/build_schema.py 生成，不要手改

CREATE TABLE users (
	id INTEGER NOT NULL, 
	email VARCHAR(255) NOT NULL, 
	name VARCHAR(100) NOT NULL, 
	created_at DATETIME NOT NULL, 
	last_login DATETIME, 
	is_active BOOLEAN NOT NULL, 
	is_admin BOOLEAN NOT NULL, 
	PRIMARY KEY (id)
);

CREATE TABLE upload_tickets (
	s3_key VARCHAR(255) NOT NULL, 
	user_id INTEGER NOT NULL, 
	filename VARCHAR(255) NOT NULL, 
	content_type VARCHAR(100) NOT NULL, 
	size BIGINT NOT NULL, 
	created_at DATETIME NOT NULL, 
	PRIMARY KEY (s3_key)
);

CREATE TABLE tags (
	id INTEGER NOT NULL, 
	name VARCHAR(100) NOT NULL, 
	created_at DATETIME, 
	created_by INTEGER NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(created_by) REFERENCES users (id)
);

CREATE TABLE files (
	id INTEGER NOT NULL, 
	filename VARCHAR(255) NOT NULL, 
	directory VARCHAR(500) NOT NULL, 
	s3_key VARCHAR(1000) NOT NULL, 
	size BIGINT NOT NULL, 
	content_type VARCHAR(100), 
	uploader_id INTEGER NOT NULL, 
	uploaded_at DATETIME NOT NULL, 
	original_filename VARCHAR(255), 
	activity_date DATE, 
	activity_type VARCHAR(50), 
	activity_name VARCHAR(200), 
	is_legacy BOOLEAN NOT NULL, 
	thumbhash VARCHAR(50), 
	embedding_status VARCHAR(32) NOT NULL, 
	face_status VARCHAR(32) NOT NULL, 
	raw_w INTEGER, 
	raw_h INTEGER, 
	orientation INTEGER NOT NULL, 
	media_status VARCHAR(16) NOT NULL, 
	media_info TEXT, 
	taken_at VARCHAR(40), 
	deleted_at DATETIME, 
	deleted_by INTEGER, 
	beats_ones JSON, 
	beats_updated_by INTEGER, 
	beats_updated_at DATETIME, 
	frame_embedding_status VARCHAR(16) DEFAULT 'pending' NOT NULL, 
	frame_face_status VARCHAR(16) DEFAULT 'pending' NOT NULL, 
	lockai_status VARCHAR(16), 
	live_id VARCHAR(64), 
	live_photo_id INTEGER, 
	live_video_id INTEGER, 
	PRIMARY KEY (id), 
	UNIQUE (s3_key), 
	FOREIGN KEY(uploader_id) REFERENCES users (id)
);

CREATE TABLE downloads (
	id VARCHAR(40) NOT NULL, 
	user_id INTEGER NOT NULL, 
	name VARCHAR(200) NOT NULL, 
	status VARCHAR(16) NOT NULL, 
	file_ids TEXT NOT NULL, 
	file_count INTEGER NOT NULL, 
	size BIGINT NOT NULL, 
	zip_size BIGINT, 
	error TEXT, 
	created_at DATETIME NOT NULL, 
	updated_at DATETIME NOT NULL, 
	finished_at DATETIME, 
	PRIMARY KEY (id), 
	FOREIGN KEY(user_id) REFERENCES users (id)
);

CREATE TABLE file_tags (
	file_id INTEGER NOT NULL, 
	tag_id INTEGER NOT NULL, 
	created_at DATETIME, 
	PRIMARY KEY (file_id, tag_id), 
	FOREIGN KEY(file_id) REFERENCES files (id) ON DELETE CASCADE, 
	FOREIGN KEY(tag_id) REFERENCES tags (id) ON DELETE CASCADE
);

CREATE TABLE lockai_jobs (
	id INTEGER NOT NULL, 
	file_id INTEGER NOT NULL, 
	requested_by INTEGER NOT NULL, 
	requested_at DATETIME NOT NULL, 
	status VARCHAR(16) NOT NULL, 
	attempts INTEGER NOT NULL, 
	started_at DATETIME, 
	finished_at DATETIME, 
	error TEXT, 
	model VARCHAR(64), 
	result JSON, 
	usage JSON, 
	PRIMARY KEY (id), 
	UNIQUE (file_id), 
	FOREIGN KEY(file_id) REFERENCES files (id)
);

CREATE TABLE beat_fixes (
	file_id INTEGER NOT NULL, 
	ones JSON NOT NULL, 
	updated_by INTEGER, 
	updated_at DATETIME NOT NULL, 
	PRIMARY KEY (file_id), 
	FOREIGN KEY(file_id) REFERENCES files (id) ON DELETE CASCADE
);

CREATE TABLE comments (
	id INTEGER NOT NULL, 
	file_id INTEGER NOT NULL, 
	user_id INTEGER NOT NULL, 
	body TEXT NOT NULL, 
	t FLOAT, 
	created_at DATETIME NOT NULL, 
	updated_at DATETIME NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(file_id) REFERENCES files (id) ON DELETE CASCADE, 
	FOREIGN KEY(user_id) REFERENCES users (id)
);

CREATE TABLE file_requests (
	id INTEGER NOT NULL, 
	file_id INTEGER, 
	requester_id INTEGER NOT NULL, 
	owner_id INTEGER NOT NULL, 
	request_type VARCHAR(20) NOT NULL, 
	status VARCHAR(20) NOT NULL, 
	proposed_changes JSON, 
	directory_info JSON, 
	message TEXT, 
	response_message TEXT, 
	created_at DATETIME NOT NULL, 
	updated_at DATETIME NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(file_id) REFERENCES files (id) ON DELETE CASCADE, 
	FOREIGN KEY(requester_id) REFERENCES users (id) ON DELETE CASCADE, 
	FOREIGN KEY(owner_id) REFERENCES users (id) ON DELETE CASCADE
);

CREATE TABLE file_logs (
	id INTEGER NOT NULL, 
	user_id INTEGER NOT NULL, 
	file_id INTEGER, 
	operation VARCHAR(6) NOT NULL, 
	file_path VARCHAR(1000), 
	timestamp DATETIME NOT NULL, 
	ip_address VARCHAR(45), 
	user_agent TEXT, 
	PRIMARY KEY (id), 
	FOREIGN KEY(user_id) REFERENCES users (id), 
	FOREIGN KEY(file_id) REFERENCES files (id)
);

CREATE VIRTUAL TABLE image_embeddings USING vec0(
      file_id INTEGER PRIMARY KEY,
      embedding FLOAT[768],
      model_name TEXT PARTITION KEY,
      +created_at TEXT
    );

CREATE VIRTUAL TABLE video_frame_embeddings USING vec0(
      frame_id INTEGER PRIMARY KEY AUTOINCREMENT,
      embedding FLOAT[768],
      model_name TEXT PARTITION KEY,
      file_id INTEGER,
      timestamp_ms INTEGER,
      +is_keyframe INTEGER,
      +created_at TEXT
    );

CREATE VIRTUAL TABLE faces USING vec0(
      face_id INTEGER PRIMARY KEY AUTOINCREMENT,
      embedding FLOAT[512],
      model_name TEXT PARTITION KEY,
      file_id INTEGER,
      person_id INTEGER,
      +frame_id INTEGER,
      +bbox_x INTEGER,
      +bbox_y INTEGER,
      +bbox_w INTEGER,
      +bbox_h INTEGER,
      +confidence_bp INTEGER,
      +created_at TEXT
    );

CREATE TABLE persons (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT,
      face_count INTEGER NOT NULL DEFAULT 0,
      cover_face_id INTEGER,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      cover_pinned INTEGER NOT NULL DEFAULT 0,
      real_person_id INTEGER
    );

CREATE TABLE real_people (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT,
      cover_pinned INTEGER NOT NULL DEFAULT 0,
      anchor_file_id INTEGER,
      anchor_bbox_x INTEGER,
      anchor_bbox_y INTEGER,
      anchor_bbox_w INTEGER,
      anchor_bbox_h INTEGER,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      anchor_frame_id INTEGER
    );

CREATE TABLE real_people_anchors (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      real_person_id INTEGER NOT NULL,
      file_id INTEGER NOT NULL,
      frame_id INTEGER,
      bbox_x INTEGER NOT NULL,
      bbox_y INTEGER NOT NULL,
      bbox_w INTEGER NOT NULL,
      bbox_h INTEGER NOT NULL,
      created_at TEXT NOT NULL
    );

CREATE UNIQUE INDEX ix_users_email ON users (email);

CREATE UNIQUE INDEX ix_tags_name ON tags (name);

CREATE INDEX ix_files_activity_name ON files (activity_name);

CREATE INDEX ix_files_activity_date ON files (activity_date);

CREATE INDEX idx_files_activity_date_type ON files (activity_date, activity_type);

CREATE INDEX idx_files_activity_date_name ON files (activity_date, activity_name);

CREATE INDEX ix_files_directory ON files (directory);

CREATE INDEX ix_files_lockai_status ON files (lockai_status);
CREATE INDEX ix_files_live_id ON files (live_id);
CREATE INDEX ix_files_live_photo_id ON files (live_photo_id);

CREATE INDEX ix_files_uploader_id ON files (uploader_id);

CREATE INDEX ix_files_deleted_at ON files (deleted_at);

CREATE INDEX ix_files_face_status ON files (face_status);

CREATE INDEX ix_files_embedding_status ON files (embedding_status);

CREATE INDEX ix_files_uploaded_at ON files (uploaded_at);

CREATE INDEX ix_files_activity_type ON files (activity_type);

CREATE INDEX ix_files_media_status ON files (media_status);

CREATE INDEX ix_downloads_user_id ON downloads (user_id);

CREATE INDEX ix_lockai_jobs_status ON lockai_jobs (status);

CREATE INDEX ix_lockai_jobs_requested_at ON lockai_jobs (requested_at);

CREATE INDEX ix_lockai_jobs_requested_by ON lockai_jobs (requested_by);

CREATE INDEX ix_comments_file_id ON comments (file_id);

CREATE INDEX idx_requests_owner_status ON file_requests (owner_id, status);

CREATE INDEX idx_requests_requester ON file_requests (requester_id);

CREATE INDEX ix_file_logs_operation ON file_logs (operation);

CREATE INDEX ix_file_logs_user_id ON file_logs (user_id);

CREATE INDEX ix_file_logs_file_id ON file_logs (file_id);

CREATE INDEX ix_file_logs_timestamp ON file_logs (timestamp);

CREATE INDEX idx_persons_name ON persons(name);

CREATE INDEX idx_persons_real_person ON persons(real_person_id) WHERE real_person_id IS NOT NULL;

CREATE UNIQUE INDEX idx_real_people_name ON real_people(name) WHERE name IS NOT NULL;

CREATE INDEX idx_real_people_anchor_file ON real_people(anchor_file_id);

CREATE INDEX idx_real_people_anchors_person ON real_people_anchors(real_person_id);

CREATE INDEX idx_real_people_anchors_file ON real_people_anchors(file_id);
