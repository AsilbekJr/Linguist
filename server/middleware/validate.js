const { z } = require('zod');

const validate =
  (schema) =>
  (req, res, next) => {
    const result = schema.safeParse({
      body: req.body,
      params: req.params,
      query: req.query,
    });
    if (!result.success) {
      return res.status(400).json({
        message: 'Validation failed',
        errors: result.error.flatten(),
      });
    }
    req.validated = result.data;
    next();
  };

const authRegisterSchema = z.object({
  body: z.object({
    name: z.string().min(2).max(80),
    email: z.string().email(),
    password: z.string().min(8).max(128),
  }),
});

const authLoginSchema = z.object({
  body: z.object({
    email: z.string().email(),
    password: z.string().min(1).max(128),
  }),
});

const wordCreateSchema = z.object({
  body: z.object({
    word: z.string().min(1).max(80),
    skipAI: z.boolean().optional(),
    fromTopic: z.boolean().optional(),
    manualDefinition: z.string().max(2000).optional(),
    manualTranslation: z.string().max(500).optional(),
    manualExamples: z.array(z.string()).optional(),
    partOfSpeech: z.string().max(50).optional(),
    synonyms: z.array(z.string()).optional(),
  }),
});

const reviewCheckSchema = z.object({
  params: z.object({ id: z.string().min(1) }),
  body: z.object({
    sentence: z.string().min(1).max(1000),
  }),
});

const syncQuestSchema = z.object({
  body: z.object({
    type: z.enum(['review', 'topic', 'immersion']),
  }),
});

const onboardSchema = z.object({
  body: z.object({
    level: z.enum(['beginner', 'intermediate', 'advanced']),
    goal: z.enum(['speaking', 'vocabulary', 'general']),
    planType: z.enum(['sprint', 'foundation', 'fluency', 'standard']),
  }),
});

const roleplaySchema = z.object({
  body: z.object({
    scenario: z.string().min(1).max(200),
    message: z.string().min(1).max(2000),
    targetWords: z.array(z.string()).optional(),
    chatHistory: z
      .array(
        z.object({
          role: z.enum(['user', 'ai']),
          content: z.string(),
        })
      )
      .optional(),
  }),
});

const speakingTranslateSchema = z.object({
  body: z.object({
    text: z.string().min(1).max(2000),
  }),
});

const checkoutSchema = z.object({
  body: z.object({
    plan: z.enum(['pro', 'premium']),
  }),
});

const practicePromptSchema = z.object({
  body: z.object({
    wordIds: z.array(z.string().min(1)).min(1).max(6),
    bucketLabel: z.string().min(2).max(120).optional(),
  }),
});

const practiceCheckSchema = z.object({
  body: z.object({
    wordIds: z.array(z.string().min(1)).min(1).max(6),
    sentence: z.string().min(3).max(800),
  }),
});

const teacherAskSchema = z.object({
  body: z.object({
    question: z.string().min(2).max(2000),
    category: z.enum(['grammar', 'vocabulary', 'phrase', 'general']).optional(),
    chatHistory: z
      .array(
        z.object({
          role: z.enum(['user', 'ai']),
          content: z.string().max(5000),
        })
      )
      .max(20)
      .optional(),
  }),
});

module.exports = {
  validate,
  authRegisterSchema,
  authLoginSchema,
  wordCreateSchema,
  reviewCheckSchema,
  syncQuestSchema,
  onboardSchema,
  roleplaySchema,
  speakingTranslateSchema,
  checkoutSchema,
  teacherAskSchema,
  practicePromptSchema,
  practiceCheckSchema,
};
