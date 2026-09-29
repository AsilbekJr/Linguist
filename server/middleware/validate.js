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
  body: z
    .object({
      /**
       * Topshiriq turi. Yuborilmasa — 'sentence' (eski mijozlar bilan moslik).
       * Qaysi rejim kutilayotganini server so'z bosqichidan o'zi aniqlaydi va
       * boshqasi yuborilsa rad etadi (utils/reviewModes.js).
       */
      mode: z.enum(['recognize', 'recall', 'sentence']).optional(),
      /** recognize: tanlangan variant; recall: yozilgan so'z */
      answer: z.string().trim().min(1).max(200).optional(),
      sentence: z.string().min(1).max(1000).optional(),
      /** Gap klaviaturadan yozildimi yoki mikrofonga aytildimi — analitika uchun */
      source: z.enum(['text', 'voice']).optional(),
    })
    .refine((b) => ((b.mode || 'sentence') === 'sentence' ? Boolean(b.sentence) : Boolean(b.answer)), {
      message: 'sentence rejimida "sentence", boshqalarida "answer" kerak',
    }),
});

/** Gap tahlili: ega, kesim va so'z turkumlarini tushuntirish */
const sentenceAnalyzeSchema = z.object({
  body: z.object({
    sentence: z.string().min(1).max(400),
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

const pushSubscribeSchema = z.object({
  body: z.object({
    endpoint: z.string().url().max(1000),
    keys: z.object({
      p256dh: z.string().min(20).max(200),
      auth: z.string().min(10).max(100),
    }),
  }),
});

const pushUnsubscribeSchema = z.object({
  body: z.object({
    endpoint: z.string().url().max(1000),
  }),
});

const notificationPrefsSchema = z.object({
  body: z
    .object({
      enabled: z.boolean().optional(),
      hour: z.number().int().min(0).max(23).optional(),
    })
    .refine((b) => b.enabled !== undefined || b.hour !== undefined, {
      message: 'enabled yoki hour kerak',
    }),
});

const unsubscribeSchema = z.object({
  body: z.object({
    token: z.string().min(16).max(128),
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

/** Profilni tahrirlash — faqat yuborilgan maydonlar o'zgaradi */
const profileUpdateSchema = z.object({
  body: z
    .object({
      name: z.string().trim().min(2).max(80).optional(),
      level: z.enum(['beginner', 'intermediate', 'advanced']).optional(),
      goal: z.enum(['speaking', 'vocabulary', 'general']).optional(),
      planType: z.enum(['sprint', 'foundation', 'fluency', 'standard']).optional(),
    })
    .strict()
    .refine((b) => Object.keys(b).length > 0, { message: 'Hech narsa yuborilmadi' }),
});

const changePasswordSchema = z.object({
  body: z.object({
    currentPassword: z.string().min(1).max(128),
    newPassword: z.string().min(8).max(128),
  }),
});

const deleteAccountSchema = z.object({
  body: z.object({
    password: z.string().min(1).max(128),
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

module.exports = {
  validate,
  objectId,
  authRegisterSchema,
  authLoginSchema,
  wordCreateSchema,
  reviewCheckSchema,
  sentenceAnalyzeSchema,
  topicQuizSubmitSchema,
  topicFinishSchema,
  challengeCompleteSchema,
  speakingEvaluateSchema,
  listeningCheckSchema,
  placementAnswerSchema,
  notificationPrefsSchema,
  unsubscribeSchema,
  pushSubscribeSchema,
  pushUnsubscribeSchema,
  timezoneSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  onboardSchema,
  profileUpdateSchema,
  changePasswordSchema,
  deleteAccountSchema,
  speakingTranslateSchema,
  checkoutSchema,
};
