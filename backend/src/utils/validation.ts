import Joi from 'joi';

// Assignment code validation
export const assignmentCodeSchema = Joi.string()
  .pattern(/^[A-Z0-9]{6}$/)
  .required()
  .messages({
    'string.pattern.base': '과제 코드는 6자리 영문 대문자와 숫자 조합이어야 합니다. (예: ABC123)',
  });

// URL validation patterns
export const githubUrlSchema = Joi.string()
  .pattern(/^https:\/\/github\.com\/[\w\-\.]+\/[\w\-\.]+/)
  .required()
  .messages({
    'string.pattern.base': '올바른 GitHub 저장소 URL을 입력해주세요.',
  });

export const blogUrlSchema = Joi.string()
  .uri()
  .pattern(/^https:\/\/([\w\-]+\.)*[a-zA-Z]{2,}\/.+$/)
  .required()
  .messages({
    'string.pattern.base': '올바른 블로그 URL을 입력해주세요.',
  });

// Blog submission schema
export const blogSubmissionSchema = Joi.object({
  assignment_code: assignmentCodeSchema,
  title: Joi.string().min(1).max(200).required().messages({
    'string.empty': '제목을 입력해주세요.',
    'string.max': '제목은 200자 이내로 입력해주세요.',
  }),
  url: blogUrlSchema,
  content: Joi.string().optional(),
});

// Code submission schema
export const codeSubmissionSchema = Joi.object({
  assignment_code: assignmentCodeSchema,
  github_url: githubUrlSchema,
  branch: Joi.string().optional().default('main'),
  specific_folder: Joi.string().optional(),
});

// Assignment creation schema
export const createAssignmentSchema = Joi.object({
  title: Joi.string().min(1).max(200).required().messages({
    'string.empty': '과제 제목을 입력해주세요.',
    'string.max': '제목은 200자 이내로 입력해주세요.',
  }),
  description: Joi.string().min(1).required().messages({
    'string.empty': '과제 설명을 입력해주세요.',
  }),
  requirements: Joi.string().min(1).required().messages({
    'string.empty': '과제 요구사항을 입력해주세요.',
  }),
  recommendations: Joi.string().optional().default(''),
  deadline: Joi.date().min('now').required().messages({
    'date.min': '마감일은 현재 시간 이후여야 합니다.',
  }),
});

// Query parameters schema
export const assignmentListQuerySchema = Joi.object({
  status: Joi.string().valid('active', 'closed', 'all').optional().default('active'),
  sort: Joi.string().valid('latest', 'deadline').optional().default('latest'),
  limit: Joi.number().integer().min(1).max(100).optional().default(20),
  offset: Joi.number().integer().min(0).optional().default(0),
});

// Validation helper function
export const validateRequestBody = (schema: Joi.ObjectSchema) => {
  return (req: any, res: any, next: any) => {
    const { error, value } = schema.validate(req.body, { 
      abortEarly: false,
      stripUnknown: true,
    });

    if (error) {
      const details = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message,
      }));

      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: '입력값이 올바르지 않습니다.',
          details,
          timestamp: new Date().toISOString(),
        },
      });
    }

    req.body = value;
    next();
  };
};

export const validateQuery = (schema: Joi.ObjectSchema) => {
  return (req: any, res: any, next: any) => {
    const { error, value } = schema.validate(req.query, {
      abortEarly: false,
      stripUnknown: true,
    });

    if (error) {
      const details = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message,
      }));

      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: '쿼리 파라미터가 올바르지 않습니다.',
          details,
          timestamp: new Date().toISOString(),
        },
      });
    }

    req.query = value;
    next();
  };
};

export const validateParams = (schema: Joi.ObjectSchema) => {
  return (req: any, res: any, next: any) => {
    const { error, value } = schema.validate(req.params, {
      abortEarly: false,
      stripUnknown: true,
    });

    if (error) {
      const details = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message,
      }));

      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: '경로 파라미터가 올바르지 않습니다.',
          details,
          timestamp: new Date().toISOString(),
        },
      });
    }

    req.params = value;
    next();
  };
};