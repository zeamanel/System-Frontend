import type { Locale } from '../../i18n/locales'
import { p, ul } from './types'
import type { AboutContent } from './types'

/**
 * The About page, in each interface language. Section ids are the same in all
 * three (checked by tests). English is the reference; the Amharic and
 * Afaan Oromoo text should be read by a native speaker before launch.
 */
export const ABOUT: Record<Locale, AboutContent> = {
  en: {
    lead:
      '[[app]] is a document workspace made for Ethiopia. Write, edit and print professional documents in Amharic, Afaan Oromoo and English — letters, contracts, invoices, applications and more — in minutes instead of hours.',
    sections: [
      {
        id: 'what',
        title: 'What you can do',
        blocks: [
          ul(
            'Start from a ready-made template for the documents people in Ethiopia write every day, or describe what you need and let AI draft it.',
            'Send photos of paper documents and voice messages from your phone through our Telegram bot, and bring the details straight into your document.',
            'Edit on a real A4 page, then print it or save it as a PDF.',
            'Save your business details, letterhead and customers once and reuse them on every document.',
          ),
        ],
      },
      {
        id: 'local',
        title: 'Made for how work is done here',
        blocks: [
          ul(
            'The app and your documents work in Amharic (Ge’ez script), Afaan Oromoo and English.',
            'Use the Ethiopian calendar and Ethiopic numerals if you prefer them.',
            'Templates are written for Ethiopian practice: letters, contracts, powers of attorney, VAT worksheets and more.',
            'Works on a phone, a tablet and a computer — for individuals, offices and print shops.',
          ),
        ],
      },
      {
        id: 'ai',
        title: 'AI helps, you decide',
        blocks: [
          p(
            '[[app]] uses AI to draft and fill in documents. AI can make mistakes: read every document carefully before you sign, print or send it. [[app]] is not a lawyer, an accountant or a notary, and what it produces is not legal, tax or professional advice.',
          ),
          p(
            'Figures such as VAT and invoice totals are calculated by the software, not by the AI. They are only as good as what you enter, so check them against your records.',
          ),
        ],
      },
      {
        id: 'data',
        title: 'Your data',
        blocks: [
          p(
            'You decide what you save. Your documents are private to your account, and our [[link:privacy]] explains exactly what we store and for how long. Our [[link:terms]] set out the rules for using the service.',
          ),
        ],
      },
      {
        id: 'contact',
        title: 'Contact',
        blocks: [
          p('Questions, feedback or a problem? Read the [[link:faq]] or write to [[email]].'),
          p('[[app]] is provided by [[legalName]].'),
        ],
      },
    ],
  },

  am: {
    lead:
      '[[app]] ለኢትዮጵያ የተሠራ የሰነድ መሥሪያ ቦታ ነው። ደብዳቤዎችን፣ ውሎችን፣ ደረሰኞችን፣ ማመልከቻዎችንና ሌሎችንም ሙያዊ ሰነዶች በአማርኛ፣ በኦሮምኛና በእንግሊዝኛ በሰዓታት ፈንታ በደቂቃዎች ውስጥ ይጻፉ፣ ያርሙና ያትሙ።',
    sections: [
      {
        id: 'what',
        title: 'ምን ማድረግ ይችላሉ',
        blocks: [
          ul(
            'በኢትዮጵያ በየቀኑ ለሚጻፉ ሰነዶች ከተዘጋጀ ናሙና ይጀምሩ፤ ወይም የሚፈልጉትን ይግለጹና AI ያዘጋጅልዎ።',
            'የወረቀት ሰነዶችን ፎቶና የድምፅ መልእክት ከስልክዎ በቴሌግራም ቦታችን በኩል ይላኩ፤ ዝርዝሩም በቀጥታ ወደ ሰነድዎ ይገባል።',
            'በትክክለኛ A4 ገጽ ላይ ያርሙ፤ ከዚያ ያትሙ ወይም እንደ PDF ያስቀምጡ።',
            'የንግድዎን መረጃ፣ የደብዳቤ ራስጌና ደንበኞችዎን አንድ ጊዜ ያስቀምጡና በሁሉም ሰነድ ላይ ደጋግመው ይጠቀሙ።',
          ),
        ],
      },
      {
        id: 'local',
        title: 'ለሥራችን አካሄድ የተሠራ',
        blocks: [
          ul(
            'መተግበሪያውና ሰነዶችዎ በአማርኛ (በግዕዝ ፊደል)፣ በኦሮምኛና በእንግሊዝኛ ይሠራሉ።',
            'ከፈለጉ የኢትዮጵያ ቀን አቆጣጠርንና የግዕዝ ቁጥሮችን ይጠቀሙ።',
            'ናሙናዎቹ ለኢትዮጵያ አሠራር የተዘጋጁ ናቸው፦ ደብዳቤዎች፣ ውሎች፣ የውክልና ሰነዶች፣ የተ.እ.ታ የሥራ ወረቀቶችና ሌሎችም።',
            'በስልክ፣ በታብሌትና በኮምፒውተር ለግለሰቦች፣ ለቢሮዎችና ለማተሚያ ቤቶች ይሠራል።',
          ),
        ],
      },
      {
        id: 'ai',
        title: 'AI ይረዳል፣ ውሳኔው የእርስዎ ነው',
        blocks: [
          p(
            '[[app]] ሰነዶችን ለማዘጋጀትና ለመሙላት AI ይጠቀማል። AI ሊሳሳት ይችላል፤ ከመፈረምዎ፣ ከማተምዎ ወይም ከመላክዎ በፊት እያንዳንዱን ሰነድ በጥንቃቄ ያንብቡ። [[app]] ጠበቃ፣ የሂሳብ ባለሙያ ወይም ኖተሪ አይደለም፤ የሚያዘጋጃቸው ሰነዶችም የሕግ፣ የታክስ ወይም የሙያ ምክር አይደሉም።',
          ),
          p(
            'እንደ ተ.እ.ታና የደረሰኝ ድምር ያሉ አሃዞች የሚሰሉት በ AI ሳይሆን በሶፍትዌሩ ነው። እነሱም እርስዎ በሚያስገቡት ልክ ብቻ ስለሆኑ ከመዝገብዎ ጋር ያመሳስሏቸው።',
          ),
        ],
      },
      {
        id: 'data',
        title: 'መረጃዎ',
        blocks: [
          p(
            'የሚያስቀምጡትን እርስዎ ይወስናሉ። ሰነዶችዎ ለመለያዎ ብቻ የተከለሉ ናቸው፤ ምን እንደምናስቀምጥና ለምን ያህል ጊዜ እንደምንይዝ [[link:privacy]] በግልጽ ያብራራል። አገልግሎቱን ለመጠቀም የሚያስፈልጉ ደንቦች በ[[link:terms]] ውስጥ ተቀምጠዋል።',
          ),
        ],
      },
      {
        id: 'contact',
        title: 'ያግኙን',
        blocks: [
          p('ጥያቄ፣ አስተያየት ወይም ችግር አለዎት? [[link:faq]] ያንብቡ ወይም ወደ [[email]] ይጻፉ።'),
          p('[[app]]ን የሚያቀርበው [[legalName]] ነው።'),
        ],
      },
    ],
  },

  om: {
    lead:
      '[[app]] iddoo hojii sanadaa Itoophiyaaf ta’e dha. Xalayaa, waliigaltee, nagahee, iyyannoo fi sanadoota ogummaa biroo Afaan Amaaraatiin, Afaan Oromootiin fi Ingiliffaan sa’aatii hedduu fakkaatu daqiiqaa muraasa keessatti barreessaa, gulaalaa fi maxxansaa.',
    sections: [
      {
        id: 'what',
        title: 'Maal gochuu dandeessu',
        blocks: [
          ul(
            'Fakkeenya sanada Itoophiyaa keessatti guyyaa guyyaan barreeffamu irraa jalqabaa, ykn waan barbaaddan ibsaatii AI-n isiniif haa qopheessu.',
            'Suuraa sanada waraqaa fi ergaa sagalee bilbila keessan irraa bot Telegram keenya karaa ergaa; odeeffannoon kallattiidhaan sanada keessanitti seena.',
            'Fuula A4 dhugaa irratti gulaalaa; ergasii maxxansaa ykn akka PDF olkaa’aa.',
            'Odeeffannoo daldala keessanii, mataduree xalayaa fi maamiltoota keessan altokko olkaa’aatii sanada hundumaaf deddeebi’aa fayyadamaa.',
          ),
        ],
      },
      {
        id: 'local',
        title: 'Akkaataa hojiin asitti hojjetamuuf kan ta’e',
        blocks: [
          ul(
            'Appiin fi sanadoonni keessan Afaan Amaaraa (qubee Ge’ez), Afaan Oromoo fi Ingiliffaan ni hojjetu.',
            'Yoo barbaaddan, kaalaandarii Itoophiyaa fi lakkoofsa Ge’ez fayyadamaa.',
            'Fakkeenyawwan hojii Itoophiyaaf qophaa’aniiru: xalayaa, waliigaltee, ragaa bakka bu’iinsaa, waraqaa hojii VAT fi kanneen biroo.',
            'Bilbilaan, taabletiin fi kompiitaraan, namoota dhuunfaa, waajjiraalee fi manneen maxxansaaf hojjeta.',
          ),
        ],
      },
      {
        id: 'ai',
        title: 'AI ni gargaara, murtiin kan keessan',
        blocks: [
          p(
            '[[app]] sanada qopheessuu fi guutuuf AI fayyadama. AI ni dogoggora; osoo hin mallatteessin, hin maxxansin ykn hin ergin dura sanada hunda of eeggannoodhaan dubbisaa. [[app]] abukaatoo, herregaa qabaa ykn notarii miti; waan qopheessus gorsa seeraa, gibiraa ykn ogummaa miti.',
          ),
          p(
            'Lakkoofsi akka VAT fi waliigala nagahee sofuweeriidhaan herregama malee AI-n miti. Lakkoofsa isin galchitan qofa waan ta’aniif galmee keessan waliin sakatta’aa.',
          ),
        ],
      },
      {
        id: 'data',
        title: 'Odeeffannoo keessan',
        blocks: [
          p(
            'Maal olkaa’uu akka qabu isin murteessitu. Sanadoonni keessan akaawuntii keessaniif qofa kan ta’an; maal akka qabnu fi hamma yoomiitti akka qabnu [[link:privacy]] ifatti ibsa. Seerri tajaajila kana itti fayyadamuu [[link:terms]] keessa jira.',
          ),
        ],
      },
      {
        id: 'contact',
        title: 'Nu quunnamaa',
        blocks: [
          p('Gaaffii, yaada ykn rakkoo qabduu? [[link:faq]] dubbisaa ykn gara [[email]] barreessaa.'),
          p('[[app]] kan dhiheessu [[legalName]] dha.'),
        ],
      },
    ],
  },
}
