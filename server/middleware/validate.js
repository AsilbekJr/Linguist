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

const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid id');

const reviewCheckSchema = z.object({
  params: z.object({ id: objectId }),
  body: z.object({
    sentence: z.string().min(1).max(1000),
  }),
});

/** 4 darajali baholash; eski mijozlar uchun `known` ham qabul qilinadi */
const reviewGradeSchema = z.object({
  params: z.object({ id: objectId }),
  body: z
    .object({
      grade: z.number().int().min(0).max(3).optional(),
      known: z.boolean().optional(),
    })
    .refine((b) => b.grade !== undefined || b.known !== undefined, {
      message: 'grade (0-3) yoki known (boolean) kerak',
    }),
});

/** Mini-test: server yaratgan sessiyaga javoblarni yuborish */
const topicQuizSubmitSchema = z.object({
  body: z.object({
    quizId: z.string().min(8).max(80),
    answers: z.array(z.number().int().min(0).max(3)).min(1).max(20),
  }),
});

const topicFinishSchema = z.object({
  body: z.object({
    quizId: z.string().min(8).max(80).optional(),
  }),
});

/**
 * Challenge audio. Base64 hajmi cheklangan — ilgari cheklov yo'q edi va
 * 16MB'lik Mongo hujjat limiti tufayli uzun yozuv 500 xatosi berardi.
 */
const challengeCompleteSchema = z.object({
  body: z.object({
    challengeId: objectId,
    audioData: z
      .string()
      .min(32)
      .max(3_500_000, "Audio juda uzun — 60 soniyagacha yozing")
      .regex(/^data:audio\/(webm|mp4|mpeg|ogg|wav)(;codecs=[\w.,-]+)?;base64,/, 'Yaroqsiz audio format')
      .optional(),
    spokenText: z.string().max(5000).optional(),
  }),
});

const placementAnswerSchema = z.object({
  body: z.object({
    sessionId: objectId,
    itemId: z.string().min(2).max(40),
    answered: z.number().int().min(0).max(3),
  }),
});

const listeningCheckSchema = z.object({
  body: z.object({
    lineIndex: z.number().int().min(0).max(50),
    typed: z.string().max(1000),
  }),
});

const speakingEvaluateSchema = z.object({
  body: z.object({
    targetSentence: z.string().min(1).max(2000),
    spokenText: z.string().min(1).max(2000),
  }),
});

const syncQuestSchema = z.object({
  body: z.object({
    type: z.enum(['review', 'topic', 'immersion']),
  }),
});

const forgotPasswordSchema = z.object({
  body: z.object({
    email: z.string().email(),
  }),
});

const resetPasswordSchema = z.object({
  body: z.object({
    token: z.string().min(32).max(128),
    password: z.string().min(8).max(128),
  }),
});

const timezoneSchema = z.object({
  body: z.object({
    timezone: z.string().min(3).max(64),
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
  objectId,
  authRegisterSchema,
  authLoginSchema,
  wordCreateSchema,
  reviewCheckSchema,
  reviewGradeSchema,
  topicQuizSubmitSchema,
  topicFinishSchema,
  challengeCompleteSchema,
  speakingEvaluateSchema,
  listeningCheckSchema,
  placementAnswerSchema,
  timezoneSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  syncQuestSchema,
  onboardSchema,
  roleplaySchema,
  speakingTranslateSchema,
  checkoutSchema,
  teacherAskSchema,
  practicePromptSchema,
  practiceCheckSchema,
};
