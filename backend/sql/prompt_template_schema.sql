CREATE TABLE IF NOT EXISTS prompt_template (
    id BIGINT PRIMARY KEY AUTO_INCREMENT COMMENT '主键ID',

    name VARCHAR(100) NOT NULL COMMENT '模板名称，如 interview_question_generation',
    version VARCHAR(50) NOT NULL COMMENT '模板版本，如 v1、v2',
    scenario VARCHAR(100) NOT NULL COMMENT '业务场景，如 interview、resume、rag、agent',
    task_type VARCHAR(100) NOT NULL COMMENT '任务类型，如 question_generation、evaluation、summary',

    template_type VARCHAR(50) NOT NULL DEFAULT 'chat' COMMENT '模板类型：text/chat',
    content MEDIUMTEXT NULL COMMENT '文本模板内容，template_type=text 时使用',
    messages JSON NULL COMMENT 'chat messages 模板，template_type=chat 时使用',

    variables JSON NULL COMMENT '变量列表，如 ["position", "resume"]',
    output_format VARCHAR(50) DEFAULT 'text' COMMENT '输出格式：text/json/markdown',

    enabled TINYINT(1) NOT NULL DEFAULT 0 COMMENT '是否为当前启用版本',
    description VARCHAR(500) NULL COMMENT '模板描述',

    created_by VARCHAR(100) NULL COMMENT '创建人',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',

    UNIQUE KEY uk_prompt_name_version (name, version),
    INDEX idx_prompt_name_enabled (name, enabled),
    INDEX idx_prompt_scenario_task (scenario, task_type),
    INDEX idx_prompt_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='提示词模板表';


CREATE TABLE IF NOT EXISTS prompt_render_log (
    id BIGINT PRIMARY KEY AUTO_INCREMENT COMMENT '主键ID',

    request_id VARCHAR(100) NULL COMMENT '请求ID',
    template_id BIGINT NOT NULL COMMENT '模板ID',
    name VARCHAR(100) NOT NULL COMMENT '模板名称',
    version VARCHAR(50) NOT NULL COMMENT '模板版本',

    variables JSON NULL COMMENT '本次渲染传入的变量',
    rendered_content MEDIUMTEXT NULL COMMENT '渲染后的文本内容',
    rendered_messages JSON NULL COMMENT '渲染后的 messages',

    success TINYINT(1) NOT NULL DEFAULT 1 COMMENT '是否成功',
    error_message TEXT NULL COMMENT '错误信息',

    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',

    INDEX idx_render_request_id (request_id),
    INDEX idx_render_template (name, version),
    INDEX idx_render_created_at (created_at),

    CONSTRAINT fk_prompt_render_template
        FOREIGN KEY (template_id)
        REFERENCES prompt_template(id)
        ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='提示词渲染日志表';

