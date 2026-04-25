INSERT INTO prompt_template (
    name,
    version,
    scenario,
    task_type,
    template_type,
    content,
    messages,
    variables,
    output_format,
    enabled,
    description,
    created_by
) VALUES
(
    'interview_question_generation',
    'v1',
    'interview',
    'question_generation',
    'chat',
    NULL,
    JSON_ARRAY(
        JSON_OBJECT(
            'role', 'system',
            'content', '你是一名{{position}}岗位的资深技术面试官。你擅长根据候选人的简历、岗位要求和真实企业面试场景设计问题。你的问题应该具体、有层次、有区分度，避免泛泛而谈。你需要同时考察候选人的基础知识、项目经历、工程实践能力和深入追问空间。'
        ),
        JSON_OBJECT(
            'role', 'user',
            'content', '请根据以下信息生成{{count}}个技术面试问题。\n\n候选人简历：\n{{resume}}\n\n岗位要求：\n{{job_requirements}}\n\n请严格按照 JSON 数组输出。每个元素必须包含：\n\n* question：面试问题\n* difficulty：easy / medium / hard\n* topic：考察主题\n* reason：为什么要问这个问题\n* follow_up_direction：如果候选人回答不充分，可以继续追问的方向\n\n要求：\n\n1. 问题必须尽量结合候选人简历中的具体经历。\n2. 不要只问“请介绍一下 XX”这种泛泛问题。\n3. 难度要有梯度。\n4. 输出必须是合法 JSON，不要添加额外解释。'
        )
    ),
    JSON_ARRAY('position', 'count', 'resume', 'job_requirements'),
    'json',
    1,
    '根据候选人简历和岗位要求生成结构化技术面试问题',
    'seed'
),
(
    'interview_answer_evaluation',
    'v1',
    'interview',
    'evaluation',
    'chat',
    NULL,
    JSON_ARRAY(
        JSON_OBJECT(
            'role', 'system',
            'content', '你是一名严格但建设性的{{position}}岗位技术面试评估官。你的任务不是简单夸奖候选人，而是根据真实面试标准，判断回答是否准确、完整、有结构、有工程深度。你需要指出问题，但表达要清晰、专业、可执行。'
        ),
        JSON_OBJECT(
            'role', 'user',
            'content', '请评估候选人对下面问题的回答。\n\n岗位：\n{{position}}\n\n面试问题：\n{{question}}\n\n候选人回答：\n{{answer}}\n\n评分标准：\n{{rubric}}\n\n请严格按照 JSON 对象输出，字段包括：\n\n* score：0 到 100 的总分\n* dimensions：对象，包含 knowledge_accuracy、structure、depth、communication 四个维度评分\n* strengths：回答中的优点数组\n* problems：回答中的问题数组\n* suggestions：改进建议数组\n* follow_up_risks：面试官可能继续追问的风险点数组\n\n要求：\n\n1. 不要输出空泛评价。\n2. 每个问题都要结合候选人的具体回答。\n3. 输出必须是合法 JSON，不要添加额外解释。'
        )
    ),
    JSON_ARRAY('position', 'question', 'answer', 'rubric'),
    'json',
    1,
    '根据候选人回答输出结构化面试评分和改进建议',
    'seed'
),
(
    'resume_analysis',
    'v1',
    'resume',
    'analysis',
    'chat',
    NULL,
    JSON_ARRAY(
        JSON_OBJECT(
            'role', 'system',
            'content', '你是一名技术招聘场景下的简历分析助手。你擅长从候选人简历中提取技能、项目经历、优势、潜在风险和适合的面试考察方向。你的分析要客观、结构化，不要编造简历中不存在的信息。'
        ),
        JSON_OBJECT(
            'role', 'user',
            'content', '请分析下面这份候选人简历。\n\n简历内容：\n{{resume}}\n\n请严格按照 JSON 对象输出，字段包括：\n\n* skills：技能标签数组\n* projects：项目经历摘要数组\n* strengths：候选人优势数组\n* risks：潜在风险或简历不清晰之处数组\n* suggested_questions：建议面试问题数组\n* suitable_positions：适合岗位方向数组\n\n要求：\n\n1. 只能基于简历内容分析，不要编造。\n2. 如果信息不足，请在 risks 中指出。\n3. 输出必须是合法 JSON，不要添加额外解释。'
        )
    ),
    JSON_ARRAY('resume'),
    'json',
    1,
    '从技术招聘角度分析简历并生成面试考察方向',
    'seed'
)
ON DUPLICATE KEY UPDATE
    scenario = VALUES(scenario),
    task_type = VALUES(task_type),
    template_type = VALUES(template_type),
    content = VALUES(content),
    messages = VALUES(messages),
    variables = VALUES(variables),
    output_format = VALUES(output_format),
    description = VALUES(description),
    updated_at = CURRENT_TIMESTAMP;

