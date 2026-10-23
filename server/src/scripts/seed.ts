/**
 * Seeds categories + clearly-labelled DEMO quizzes (isSeed: true).
 * Optional admin: set SEED_ADMIN_EMAIL, SEED_ADMIN_USERNAME and SEED_ADMIN_PASSWORD in your .env
 * (nothing is hardcoded; no default credentials exist).
 */
import mongoose from 'mongoose'
import { randomBytes } from 'node:crypto'
import { env } from '../config/env.js'
import { Category } from '../models/Misc.js'
import { Quiz } from '../models/Quiz.js'
import { User } from '../models/User.js'
import { hashPassword } from '../modules/auth/service.js'

const CATEGORIES = [
  { slug: 'it', names: { uz: 'IT', ru: 'IT', en: 'IT' }, color: '#8b5cf6', icon: 'code', order: 1 },
  { slug: 'english', names: { uz: 'Ingliz tili', ru: 'Английский язык', en: 'English' }, color: '#22d3ee', icon: 'languages', order: 2 },
  { slug: 'math', names: { uz: 'Matematika', ru: 'Математика', en: 'Mathematics' }, color: '#f59e0b', icon: 'calculator', order: 3 },
  { slug: 'science', names: { uz: 'Fan', ru: 'Наука', en: 'Science' }, color: '#22c55e', icon: 'flask', order: 4 },
  { slug: 'history', names: { uz: 'Tarix', ru: 'История', en: 'History' }, color: '#fb7185', icon: 'landmark', order: 5 },
  { slug: 'geography', names: { uz: 'Geografiya', ru: 'География', en: 'Geography' }, color: '#3b82f6', icon: 'globe', order: 6 },
  { slug: 'general', names: { uz: 'Umumiy bilim', ru: 'Общие знания', en: 'General knowledge' }, color: '#ec4899', icon: 'lightbulb', order: 7 },
]

type Q = [text: string, options: string[], correct: number, explanation?: string]
interface QuizSeed { title: string; description: string; category: string; language: 'uz' | 'ru' | 'en'; difficulty: 'easy' | 'medium' | 'hard'; questions: Q[] }

const QUIZZES: QuizSeed[] = [
  {
    title: 'Veb dasturlash asoslari', description: 'HTML, CSS, JavaScript va asosiy vositalar bo‘yicha qisqa quiz.', category: 'it', language: 'uz', difficulty: 'easy',
    questions: [
      ['HTML nimaning qisqartmasi?', ['HyperText Markup Language', 'High Tech Modern Language', 'Hyper Transfer Markup Logic', 'Home Tool Markup Language'], 0],
      ['Brauzerda sahifaga interaktivlik beradigan til qaysi?', ['SQL', 'JavaScript', 'C++', 'Bash'], 1],
      ['CSS nima uchun ishlatiladi?', ['Ma’lumotlar bazasi uchun', 'Sahifani bezash va joylashtirish uchun', 'Serverni sozlash uchun', 'Parollarni shifrlash uchun'], 1],
      ['React kutubxonasini qaysi kompaniya yaratgan?', ['Google', 'Microsoft', 'Meta (Facebook)', 'Apple'], 2],
      ['Git nima?', ['Brauzer', 'Versiyalarni boshqarish tizimi', 'Dasturlash tili', 'Operatsion tizim'], 1],
    ],
  },
  {
    title: 'English Grammar Basics', description: 'Tenses, plurals and prepositions — a quick warm-up.', category: 'english', language: 'en', difficulty: 'easy',
    questions: [
      ['She ___ to school every day.', ['go', 'goes', 'going', 'gone'], 1, 'Third person singular takes -s/-es in Present Simple.'],
      ['What is the past simple of “go”?', ['goed', 'gone', 'went', 'going'], 2],
      ['What is the plural of “child”?', ['childs', 'childrens', 'children', 'childes'], 2],
      ['I have lived here ___ 2020.', ['for', 'since', 'from', 'during'], 1, '“Since” is used with a starting point in time.'],
      ['What is the opposite of “ancient”?', ['old', 'modern', 'huge', 'quiet'], 1],
    ],
  },
  {
    title: 'Quick Math', description: 'Five fast questions to wake up your brain.', category: 'math', language: 'en', difficulty: 'medium',
    questions: [
      ['What is 7 × 8?', ['54', '56', '58', '64'], 1],
      ['What is the square root of 144?', ['10', '11', '12', '14'], 2],
      ['What is 15% of 200?', ['20', '25', '30', '35'], 2],
      ['What is 2 to the power of 10?', ['512', '1000', '1024', '2048'], 2],
      ['What is the sum of the angles in a triangle?', ['90°', '180°', '270°', '360°'], 1],
    ],
  },
  {
    title: 'Science Essentials', description: 'Chemistry, physics and biology basics.', category: 'science', language: 'en', difficulty: 'easy',
    questions: [
      ['What is the chemical formula of water?', ['CO2', 'O2', 'H2O', 'NaCl'], 2],
      ['Which planet is closest to the Sun?', ['Venus', 'Mercury', 'Earth', 'Mars'], 1],
      ['Which force pulls objects towards the Earth?', ['Magnetism', 'Friction', 'Gravity', 'Inertia'], 2],
      ['Which gas do plants absorb for photosynthesis?', ['Oxygen', 'Nitrogen', 'Carbon dioxide', 'Hydrogen'], 2],
      ['What is at the centre of an atom?', ['Electron', 'Nucleus', 'Molecule', 'Cell'], 1],
    ],
  },
  {
    title: 'O‘zbekiston va jahon tarixi', description: 'Tarixdan asosiy sanalar va shaxslar.', category: 'history', language: 'uz', difficulty: 'medium',
    questions: [
      ['Amir Temur qaysi yilda tug‘ilgan?', ['1136', '1236', '1336', '1436'], 2],
      ['Ikkinchi jahon urushi qaysi yilda tugagan?', ['1939', '1943', '1945', '1950'], 2],
      ['O‘zbekiston mustaqilligi qaysi yilda e’lon qilingan?', ['1989', '1990', '1991', '1992'], 2],
      ['Mirzo Ulug‘bek qaysi sohadagi ishlari bilan mashhur?', ['Astronomiya', 'Tibbiyot', 'Harbiy san’at', 'Me’morchilik faqat'], 0],
      ['Buyuk Ipak yo‘li qaysi qit’alarni bog‘lagan?', ['Amerika va Afrika', 'Osiyo va Yevropa', 'Avstraliya va Antarktida', 'Faqat Afrika'], 1],
    ],
  },
  {
    title: 'World Geography', description: 'Capitals, oceans and landmarks.', category: 'geography', language: 'en', difficulty: 'easy',
    questions: [
      ['What is the capital of Germany?', ['Paris', 'Berlin', 'London', 'Washington, DC'], 1],
      ['What is the capital of Uzbekistan?', ['Samarkand', 'Bukhara', 'Tashkent', 'Namangan'], 2],
      ['Which is the largest ocean?', ['Atlantic', 'Indian', 'Arctic', 'Pacific'], 3],
      ['On which continent is Egypt located?', ['Asia', 'Africa', 'Europe', 'South America'], 1],
      ['In which mountain range is Mount Everest?', ['Alps', 'Andes', 'Himalayas', 'Rockies'], 2],
    ],
  },
  {
    title: 'Общие знания: лёгкая разминка', description: 'Пять простых вопросов на эрудицию.', category: 'general', language: 'ru', difficulty: 'easy',
    questions: [
      ['Сколько дней в високосном году?', ['364', '365', '366', '367'], 2],
      ['Какую планету называют «Красной планетой»?', ['Венера', 'Марс', 'Юпитер', 'Сатурн'], 1],
      ['Сколько цветов в радуге?', ['5', '6', '7', '8'], 2],
      ['Кто автор романа «Война и мир»?', ['Фёдор Достоевский', 'Антон Чехов', 'Лев Толстой', 'Иван Тургенев'], 2],
      ['Какой город является столицей Японии?', ['Киото', 'Осака', 'Токио', 'Нагоя'], 2],
    ],
  },
]

async function main() {
  await mongoose.connect(env.MONGODB_URI)

  for (const c of CATEGORIES) await Category.updateOne({ slug: c.slug }, { $set: c }, { upsert: true })
  console.log(`Categories: ${CATEGORIES.length}`)

  // Demo content owner: cannot log in (random, unrecoverable password).
  let owner = await User.findOne({ usernameLower: 'uzquiz_demo' })
  if (!owner) {
    owner = await User.create({
      name: 'UZQUIZ Demo', username: 'uzquiz_demo', usernameLower: 'uzquiz_demo', email: 'demo@uzquiz.invalid',
      passwordHash: await hashPassword(randomBytes(32).toString('hex')), role: 'moderator', emailVerified: true, onboarded: true,
    })
  }

  await Quiz.deleteMany({ isSeed: true })
  for (const z of QUIZZES) {
    await Quiz.create({
      title: z.title, description: z.description, category: z.category, language: z.language, difficulty: z.difficulty,
      creator: owner._id, isSeed: true, visibility: 'public',
      questions: z.questions.map(([text, options, correctIndex, explanation]) => ({ text, options: options.map((t) => ({ text: t })), correctIndex, timeLimit: 20, explanation: explanation ?? '' })),
    })
  }
  console.log(`Demo quizzes: ${QUIZZES.length} (marked as demo content)`)

  const { SEED_ADMIN_EMAIL: email, SEED_ADMIN_USERNAME: username, SEED_ADMIN_PASSWORD: password } = process.env
  if (email && username && password) {
    if (!(await User.exists({ email: email.toLowerCase() }))) {
      await User.create({ name: 'Administrator', username, usernameLower: username.toLowerCase(), email: email.toLowerCase(), passwordHash: await hashPassword(password), role: 'admin', emailVerified: true, onboarded: true })
      console.log(`Admin created: ${username}`)
    } else console.log('Admin e-mail already exists — skipped.')
  } else console.log('No SEED_ADMIN_* variables set — admin not created.')

  await mongoose.disconnect()
}

main().catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1) })
