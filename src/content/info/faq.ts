import type { Locale } from '../../i18n/locales'
import { p, ul } from './types'
import type { FaqGroup } from './types'

/**
 * Frequently asked questions, in each interface language. Group and question
 * ids are the same in all three (checked by tests) and are the anchors other
 * pages link to (…/faq#payments). English is the reference; the Amharic and
 * Afaan Oromoo text should be read by a native speaker before launch.
 *
 * The retention times below (24 hours, 365 days, 7 days) are the real ones in
 * the backend (TELEGRAM_MEDIA_RETENTION_MS, CUSTOMER_RETENTION_DAYS,
 * UNUSED_MEDIA_DAYS); change them together.
 */
export const FAQ: Record<Locale, FaqGroup[]> = {
  en: [
    {
      id: 'start',
      title: 'Getting started',
      items: [
        {
          id: 'what-is',
          q: 'What is [[app]]?',
          a: [
            p(
              '[[app]] is a document workspace for Ethiopia: you start from a template or describe what you need, AI drafts the document, and you edit it on an A4 page and print it or save it as a PDF. Read more on the [[link:about]] page.',
            ),
          ],
        },
        {
          id: 'languages',
          q: 'Which languages can I use?',
          a: [
            p(
              'The app and your documents work in English, Amharic and Afaan Oromoo. Choose your language when you first sign in and change it any time in Settings. The Afaan Oromoo interface is still partly in English; documents can be written fully in Afaan Oromoo.',
            ),
          ],
        },
        {
          id: 'cost',
          q: 'Is it free?',
          a: [
            p(
              'Every account gets free AI credits each day. Paid plans give more credits per day. Prices and what each plan includes are shown on the Plans & billing page.',
            ),
          ],
        },
      ],
    },
    {
      id: 'documents',
      title: 'Documents & AI',
      items: [
        {
          id: 'ai-accuracy',
          q: 'Can I trust what the AI writes?',
          a: [
            p(
              'Treat it as a first draft. AI can make mistakes — wrong names, dates, amounts or legal wording. Read the whole document before you sign, print or send it.',
            ),
            p(
              'For contracts, wills, court papers and anything with serious legal or financial consequences, have a lawyer check it. Documents that must be authenticated or registered (for example at the Documents Authentication and Registration Service) still have to go through that process.',
            ),
          ],
        },
        {
          id: 'numbers',
          q: 'Are the numbers in invoices and VAT reports right?',
          a: [
            p(
              'Totals, VAT and the boxes of the VAT worksheet are calculated by the software, not guessed by the AI, so the arithmetic is exact. They are only as good as the figures you enter, so check them against your records and the Ministry of Revenues e-tax portal before you file.',
            ),
          ],
        },
        {
          id: 'ai-privacy',
          q: 'What happens to the text I give the AI?',
          a: [
            p(
              'To write your document, the details you enter (and the text of any file you ask us to read) are sent securely to Google’s Gemini AI service, which we use through Google Cloud. We use it only to produce your result, and we do not use your documents to train our own AI models. Details are in the [[link:privacy]].',
            ),
          ],
        },
      ],
    },
    {
      id: 'telegram',
      title: 'Telegram bot',
      items: [
        {
          id: 'telegram-how',
          q: 'How do I send photos or voice messages from my phone?',
          a: [
            p(
              'Open Telegram files in the app and follow the steps to connect the [[app]] bot in Telegram. Then send a photo, a file or a voice message to the bot: it reads the text and brings it into your document page, where you check it before you use it.',
            ),
          ],
        },
        {
          id: 'telegram-keep',
          q: 'How long are my Telegram files kept?',
          a: [
            p(
              'For 24 hours. After that they are deleted automatically. You can delete them sooner: send /revoke to the bot to delete what you shared with the last page, or /forget to delete your bot profile and everything you shared. Send /privacy to see the policy links.',
            ),
          ],
        },
      ],
    },
    {
      id: 'payments',
      title: 'Plans & payments',
      items: [
        {
          id: 'payments',
          q: 'How do I pay?',
          a: [
            p(
              'Choose a plan on the Plans & billing page and pay on Chapa’s secure payment page. When Chapa confirms your payment, your plan starts right away. If your plan has not appeared after a few minutes, refresh the page; if it still has not, write to [[email]] with the date and the amount.',
            ),
          ],
        },
        {
          id: 'payments-safe',
          q: 'Is my payment information safe?',
          a: [
            p(
              'You pay on Chapa’s page, not ours, so we never see or store your card or mobile-money details. We keep only a record of the payment: the plan, the amount, the status and Chapa’s reference.',
            ),
          ],
        },
        {
          id: 'refunds',
          q: 'Can I get a refund?',
          a: [p('[[refund]]')],
        },
      ],
    },
    {
      id: 'data',
      title: 'Your data & privacy',
      items: [
        {
          id: 'data-kept',
          q: 'What do you keep, and for how long?',
          a: [
            ul(
              'Your documents: until you delete them. Deleted documents go to Trash first, so you can restore them.',
              'Saved customers: removed 365 days after you last used them.',
              'Uploaded logos and images that no document or profile uses: removed after 7 days.',
              'Files and messages you send to the Telegram bot: removed after 24 hours.',
            ),
            p('The full list is in the [[link:privacy]].'),
          ],
        },
        {
          id: 'data-delete',
          q: 'How do I delete my data?',
          a: [
            p(
              'You can delete documents, saved customers and your organization details yourself in the app, and use /revoke or /forget in the Telegram bot. To delete your account and everything in it, write to [[email]] from the email address you signed up with.',
            ),
          ],
        },
        {
          id: 'data-who',
          q: 'Who can see my documents?',
          a: [
            p(
              'Your documents are private to your account. If you belong to an organization, its members share the saved customers and the organization profile, and you can choose to share a document with them.',
            ),
          ],
        },
        {
          id: 'problem',
          q: 'I found a mistake, or something is not working.',
          a: [
            p(
              'Write to [[email]] and tell us what you were doing, what you expected and what happened. A screenshot helps. Please never send your password.',
            ),
          ],
        },
      ],
    },
  ],

  am: [
    {
      id: 'start',
      title: 'መጀመር',
      items: [
        {
          id: 'what-is',
          q: '[[app]] ምንድን ነው?',
          a: [
            p(
              '[[app]] ለኢትዮጵያ የተሠራ የሰነድ መሥሪያ ቦታ ነው፦ ከናሙና ይጀምራሉ ወይም የሚፈልጉትን ይገልጻሉ፣ AI ሰነዱን ያዘጋጃል፣ እርስዎም በA4 ገጽ ላይ አርመው ያትማሉ ወይም እንደ PDF ያስቀምጣሉ። ተጨማሪውን በ[[link:about]] ገጽ ላይ ያንብቡ።',
            ),
          ],
        },
        {
          id: 'languages',
          q: 'የትኞቹን ቋንቋዎች መጠቀም እችላለሁ?',
          a: [
            p(
              'መተግበሪያውና ሰነዶችዎ በእንግሊዝኛ፣ በአማርኛና በኦሮምኛ ይሠራሉ። ለመጀመሪያ ጊዜ ሲገቡ ቋንቋዎን ይምረጡ፤ በማንኛውም ጊዜ በቅንብሮች መቀየር ይችላሉ። የኦሮምኛ የመተግበሪያ ገጽ አሁንም በከፊል በእንግሊዝኛ ነው፤ ሰነዶች ግን ሙሉ በሙሉ በኦሮምኛ ሊጻፉ ይችላሉ።',
            ),
          ],
        },
        {
          id: 'cost',
          q: 'በነጻ ይሠራል?',
          a: [
            p(
              'እያንዳንዱ መለያ በየቀኑ ነጻ የAI ክሬዲት ያገኛል። የሚከፈልባቸው ዕቅዶች በየቀኑ ተጨማሪ ክሬዲት ይሰጣሉ። ዋጋዎችና እያንዳንዱ ዕቅድ የሚያካትተው በ“ዕቅዶችና ክፍያ” ገጽ ላይ ይታያሉ።',
            ),
          ],
        },
      ],
    },
    {
      id: 'documents',
      title: 'ሰነዶችና AI',
      items: [
        {
          id: 'ai-accuracy',
          q: 'AI የሚጽፈውን ማመን እችላለሁ?',
          a: [
            p(
              'እንደ መጀመሪያ ረቂቅ ይመልከቱት። AI ሊሳሳት ይችላል — የተሳሳተ ስም፣ ቀን፣ መጠን ወይም የሕግ አገላለጽ። ከመፈረምዎ፣ ከማተምዎ ወይም ከመላክዎ በፊት ሙሉውን ሰነድ ያንብቡ።',
            ),
            p(
              'ለውሎች፣ ለኑዛዜዎች፣ ለፍርድ ቤት ወረቀቶችና ከባድ የሕግ ወይም የገንዘብ ውጤት ላላቸው ነገሮች ሁሉ ጠበቃ ያስመርምሩ። መረጋገጥ ወይም መመዝገብ የሚገባቸው ሰነዶች (ለምሳሌ በሰነዶች ማረጋገጫና ምዝገባ አገልግሎት) አሁንም ያንን ሂደት ማለፍ አለባቸው።',
            ),
          ],
        },
        {
          id: 'numbers',
          q: 'በደረሰኞችና በተ.እ.ታ ሪፖርቶች ያሉት አሃዞች ትክክል ናቸው?',
          a: [
            p(
              'ድምሮች፣ ተ.እ.ታና የተ.እ.ታ የሥራ ወረቀት ሳጥኖች የሚሰሉት በሶፍትዌሩ ነው እንጂ AI አይገምታቸውም፤ ስለዚህ ስሌቱ ትክክል ነው። ነገር ግን እርስዎ በሚያስገቡት አሃዝ ልክ ብቻ ስለሆኑ ከማስገባትዎ በፊት ከመዝገብዎና ከገቢዎች ሚኒስቴር የኤሌክትሮኒክ ታክስ ፖርታል ጋር ያመሳስሏቸው።',
            ),
          ],
        },
        {
          id: 'ai-privacy',
          q: 'ለAI የምሰጠው ጽሑፍ ምን ይሆናል?',
          a: [
            p(
              'ሰነድዎን ለመጻፍ የሚያስገቡት ዝርዝር (እና እንድናነብ የሚጠይቁት የፋይል ጽሑፍ) በደኅንነት ወደ Google Gemini AI አገልግሎት ይላካል፤ ይህንን በGoogle Cloud በኩል እንጠቀማለን። ውጤትዎን ለማዘጋጀት ብቻ ነው የምንጠቀመው፤ ሰነዶችዎንም የራሳችንን AI ሞዴሎች ለማሰልጠን አንጠቀምም። ዝርዝሩ በ[[link:privacy]] ውስጥ ይገኛል።',
            ),
          ],
        },
      ],
    },
    {
      id: 'telegram',
      title: 'የቴሌግራም ቦት',
      items: [
        {
          id: 'telegram-how',
          q: 'ከስልኬ ፎቶ ወይም የድምፅ መልእክት እንዴት እልካለሁ?',
          a: [
            p(
              'በመተግበሪያው ውስጥ “የቴሌግራም ፋይሎች” ይክፈቱና [[app]] ቦትን በቴሌግራም ለማገናኘት ደረጃዎቹን ይከተሉ። ከዚያ ፎቶ፣ ፋይል ወይም የድምፅ መልእክት ወደ ቦቱ ይላኩ፤ ቦቱ ጽሑፉን አንብቦ ወደ ሰነድ ገጽዎ ያመጣዋል፤ ከመጠቀምዎ በፊት እርስዎ ይመረምሩታል።',
            ),
          ],
        },
        {
          id: 'telegram-keep',
          q: 'የቴሌግራም ፋይሎቼ ለምን ያህል ጊዜ ይቆያሉ?',
          a: [
            p(
              'ለ24 ሰዓታት። ከዚያ በኋላ በራስ-ሰር ይሰረዛሉ። ቀድመው ለመሰረዝ ከፈለጉ፦ ለመጨረሻው ገጽ ያጋሩትን ለመሰረዝ ለቦቱ /revoke ይላኩ፤ የቦት መገለጫዎንና ያጋሩትን ሁሉ ለመሰረዝ ደግሞ /forget ይላኩ። የፖሊሲ አገናኞችን ለማየት /privacy ይላኩ።',
            ),
          ],
        },
      ],
    },
    {
      id: 'payments',
      title: 'ዕቅዶችና ክፍያ',
      items: [
        {
          id: 'payments',
          q: 'እንዴት እከፍላለሁ?',
          a: [
            p(
              'በ“ዕቅዶችና ክፍያ” ገጽ ዕቅድ ይምረጡና በChapa ደኅንነቱ በተጠበቀ የክፍያ ገጽ ላይ ይክፈሉ። Chapa ክፍያዎን ሲያረጋግጥ ዕቅድዎ ወዲያውኑ ይጀምራል። ከጥቂት ደቂቃዎች በኋላ ዕቅድዎ ካልታየ ገጹን ያድሱ፤ አሁንም ካልታየ ቀኑንና መጠኑን ጽፈው ወደ [[email]] ይላኩ።',
            ),
          ],
        },
        {
          id: 'payments-safe',
          q: 'የክፍያ መረጃዬ ደኅንነቱ የተጠበቀ ነው?',
          a: [
            p(
              'የሚከፍሉት በChapa ገጽ እንጂ በእኛ አይደለም፤ ስለዚህ የካርድዎን ወይም የሞባይል ገንዘብ መረጃዎን አናይም፣ አናስቀምጥምም። የምናስቀምጠው የክፍያውን መዝገብ ብቻ ነው፦ ዕቅዱን፣ መጠኑን፣ ሁኔታውንና የChapa ማጣቀሻ ቁጥሩን።',
            ),
          ],
        },
        {
          id: 'refunds',
          q: 'ገንዘብ መመለስ እችላለሁ?',
          a: [p('[[refund]]')],
        },
      ],
    },
    {
      id: 'data',
      title: 'መረጃዎና ግላዊነት',
      items: [
        {
          id: 'data-kept',
          q: 'ምን ያስቀምጣሉ፣ ለምን ያህል ጊዜስ?',
          a: [
            ul(
              'ሰነዶችዎ፦ እስከሚሰርዟቸው ድረስ። የተሰረዙ ሰነዶች መጀመሪያ ወደ መጣያ ይሄዳሉ፤ መመለስ ይችላሉ።',
              'የተቀመጡ ደንበኞች፦ ለመጨረሻ ጊዜ ከተጠቀሙባቸው ከ365 ቀናት በኋላ ይወገዳሉ።',
              'ማንኛውም ሰነድ ወይም መገለጫ የማይጠቀምባቸው የተጫኑ አርማዎችና ምስሎች፦ ከ7 ቀናት በኋላ ይወገዳሉ።',
              'ወደ ቴሌግራም ቦት የሚልኳቸው ፋይሎችና መልእክቶች፦ ከ24 ሰዓታት በኋላ ይወገዳሉ።',
            ),
            p('ሙሉ ዝርዝሩ በ[[link:privacy]] ውስጥ ይገኛል።'),
          ],
        },
        {
          id: 'data-delete',
          q: 'መረጃዬን እንዴት እሰርዛለሁ?',
          a: [
            p(
              'ሰነዶችን፣ የተቀመጡ ደንበኞችንና የድርጅትዎን መረጃ በመተግበሪያው ውስጥ ራስዎ መሰረዝ ይችላሉ፤ በቴሌግራም ቦት ደግሞ /revoke ወይም /forget ይጠቀሙ። መለያዎንና በውስጡ ያለውን ሁሉ ለመሰረዝ፣ ከተመዘገቡበት ኢሜይል አድራሻ ወደ [[email]] ይጻፉ።',
            ),
          ],
        },
        {
          id: 'data-who',
          q: 'ሰነዶቼን ማን ማየት ይችላል?',
          a: [
            p(
              'ሰነዶችዎ ለመለያዎ ብቻ የተከለሉ ናቸው። የድርጅት አባል ከሆኑ፣ አባላቱ የተቀመጡ ደንበኞችንና የድርጅቱን መገለጫ ይጋራሉ፤ አንድን ሰነድ ደግሞ ከእነሱ ጋር ማጋራት ይችላሉ።',
            ),
          ],
        },
        {
          id: 'problem',
          q: 'ስህተት አግኝቻለሁ ወይም የሆነ ነገር አይሠራም።',
          a: [
            p(
              'ወደ [[email]] ይጻፉና ምን እያደረጉ እንደነበር፣ ምን እንደጠበቁና ምን እንደተከሰተ ይንገሩን። ስክሪንሾት ይረዳል። እባክዎ የይለፍ ቃልዎን በፍጹም አይላኩ።',
            ),
          ],
        },
      ],
    },
  ],

  om: [
    {
      id: 'start',
      title: 'Jalqabuu',
      items: [
        {
          id: 'what-is',
          q: '[[app]] maali?',
          a: [
            p(
              '[[app]] iddoo hojii sanadaa Itoophiyaaf kan ta’e dha: fakkeenya irraa jalqabdu ykn waan barbaaddan ibsitu, AI-n sanada qopheessa, isin ammoo fuula A4 irratti gulaaltanii maxxansaa ykn akka PDF olkaa’attu. Dabalataaf fuula [[link:about]] dubbisaa.',
            ),
          ],
        },
        {
          id: 'languages',
          q: 'Afaan kam fayyadamuu dandeessa?',
          a: [
            p(
              'Appii fi sanadoonni keessan Ingiliffa, Afaan Amaaraa fi Afaan Oromootiin ni hojjetu. Yeroo jalqabaaf galtan afaan keessan filadhaa; yeroo kamiyyuu Qindaa’ina keessatti jijjiiruu dandeessu. Fuulli appii Afaan Oromoo amma iyyuu gartokkeen Ingiliffaadha; sanadoonni garuu guutummaatti Afaan Oromootiin barreeffamuu danda’u.',
            ),
          ],
        },
        {
          id: 'cost',
          q: 'Bilisaan hojjetaa?',
          a: [
            p(
              'Akaawuntiin hundi guyyaa guyyaan kireediitii AI bilisaa argata. Karoorri kaffaltii guyyaa guyyaan kireediitii dabalataa kenna. Gatiin fi waan karoorri tokko of keessaa qabu fuula “Karoora fi kaffaltii” irratti ni agarsiifama.',
            ),
          ],
        },
      ],
    },
    {
      id: 'documents',
      title: 'Sanadoota fi AI',
      items: [
        {
          id: 'ai-accuracy',
          q: 'Waan AI barreessu amanuu nan danda’aa?',
          a: [
            p(
              'Akka waraqaa jalqabaatti ilaalaa. AI ni dogoggora — maqaa, guyyaa, hanga ykn jecha seeraa dogoggoraa. Osoo hin mallatteessin, hin maxxansin ykn hin ergin dura sanada guutuu dubbisaa.',
            ),
            p(
              'Waliigaltee, ajajaa dhaaltummaa, waraqaa mana murtii fi waan bu’aa seeraa ykn maallaqaa ulfaataa qabu hundaaf abukaatoon haa ilaalu. Sanadoonni mirkaneeffamuu ykn galmaa’uu qaban (fkn. Tajaajila Mirkaneessaa fi Galmee Sanadootaatti) ammayyuu adeemsa sana darbuu qabu.',
            ),
          ],
        },
        {
          id: 'numbers',
          q: 'Lakkoofsonni nagahee fi gabaasa VAT keessaa sirrii dha?',
          a: [
            p(
              'Waliigalli, VAT fi saanduqni waraqaa hojii VAT sofuweeriidhaan herregama malee AI-n hin tilmaamu; kanaaf herregni sirrii dha. Garuu lakkoofsa isin galchitan qofa waan ta’aniif osoo hin galchin dura galmee keessanii fi poortaalii gibiraa elektirooniksii Ministeera Galiiwwanii waliin sakatta’aa.',
            ),
          ],
        },
        {
          id: 'ai-privacy',
          q: 'Barreeffamni AI’tti kennu maal ta’a?',
          a: [
            p(
              'Sanada keessan barreessuuf, odeeffannoon galchitan (fi barreeffama faayilii akka dubbisnu gaafattan) amansiisaadhaan tajaajila AI Google Gemini’tti ergama; kana karaa Google Cloud fayyadamna. Bu’aa keessan qopheessuuf qofa fayyadamna; sanada keessan fakkeenya AI keenya leenjisuuf hin fayyadamnu. Bal’inni [[link:privacy]] keessa jira.',
            ),
          ],
        },
      ],
    },
    {
      id: 'telegram',
      title: 'Bot Telegram',
      items: [
        {
          id: 'telegram-how',
          q: 'Suuraa ykn ergaa sagalee bilbila kootii akkamittan erga?',
          a: [
            p(
              'Appii keessatti “Faayilota Telegram” banaatii bot [[app]] Telegram irratti walqabsiisuuf tarkaanfii hordofaa. Itti aansuun suuraa, faayilii ykn ergaa sagalee bot’tti ergaa; botni barreeffama dubbisee fuula sanada keessanitti fida; osoo hin fayyadamin dura isin ni mirkaneessitu.',
            ),
          ],
        },
        {
          id: 'telegram-keep',
          q: 'Faayilonni Telegram koo hamma yoomiitti turu?',
          a: [
            p(
              'Sa’aatii 24. Booda ofumaan haqamu. Dafee haquu yoo barbaaddan: waan fuula dhumaa waliin qooddan haquuf bot’tti /revoke ergaa; piroofaayilii bot keessanii fi waan qooddan hunda haquuf immoo /forget ergaa. Hidhatawwan imaammataa ilaaluuf /privacy ergaa.',
            ),
          ],
        },
      ],
    },
    {
      id: 'payments',
      title: 'Karoora fi kaffaltii',
      items: [
        {
          id: 'payments',
          q: 'Akkamitti kaffala?',
          a: [
            p(
              'Fuula “Karoora fi kaffaltii” irratti karoora filadhaatii fuula kaffaltii amansiisaa Chapa irratti kaffalaa. Chapa kaffaltii keessan yommuu mirkaneessu karooriin keessan battalumatti jalqaba. Daqiiqaa muraasa booda karooriin yoo hin mul’anne fuula haaromsaa; ammayyuu yoo hin mul’anne guyyaa fi hanga barreessaatii gara [[email]] ergaa.',
            ),
          ],
        },
        {
          id: 'payments-safe',
          q: 'Odeeffannoon kaffaltii koo eegamaa dha?',
          a: [
            p(
              'Kaffaltiin kan raawwatamu fuula Chapa irratti malee kan keenya irratti miti; kanaaf odeeffannoo kaardii ykn maallaqa moobaayilaa keessanii hin arginu, hin kuufnus. Galmee kaffaltii qofa kuufna: karoora, hanga, haala fi lakkoofsa wabii Chapa.',
            ),
          ],
        },
        {
          id: 'refunds',
          q: 'Maallaqa deebisuu nan danda’aa?',
          a: [p('[[refund]]')],
        },
      ],
    },
    {
      id: 'data',
      title: 'Odeeffannoo keessan fi dhuunfaa',
      items: [
        {
          id: 'data-kept',
          q: 'Maal kuufattu, hamma yoomiitti?',
          a: [
            ul(
              'Sanadoota keessan: hanga isin haqxanitti. Sanadoonni haqaman jalqaba kuusaa kosii keessa deemu; deebisuu dandeessu.',
              'Maamiltoota olkaa’aman: yeroo dhumaaf erga itti fayyadamtanii booda guyyaa 365 booda ni haqamu.',
              'Mallattoo fi suuraawwan olkaa’aman sanadni ykn piroofaayiliin tokkollee itti hin fayyadamne: guyyaa 7 booda ni haqamu.',
              'Faayiloota fi ergaawwan bot Telegram’tti ergitan: sa’aatii 24 booda ni haqamu.',
            ),
            p('Tarreen guutuun [[link:privacy]] keessa jira.'),
          ],
        },
        {
          id: 'data-delete',
          q: 'Odeeffannoo koo akkamitti haqa?',
          a: [
            p(
              'Sanadoota, maamiltoota olkaa’aman fi odeeffannoo dhaabbata keessanii appii keessatti of danda’uun haquu dandeessu; bot Telegram keessatti immoo /revoke ykn /forget fayyadamaa. Akaawuntii fi waan keessa jiru hunda haquuf, teessoo imeelii itti galmooftan irraa gara [[email]] barreessaa.',
            ),
          ],
        },
        {
          id: 'data-who',
          q: 'Sanadoota koo eenyutu arguu danda’a?',
          a: [
            p(
              'Sanadoonni keessan akaawuntii keessaniif qofa kan ta’an. Miseensa dhaabbataa yoo taatan, miseensonni maamiltoota olkaa’aman fi piroofaayila dhaabbataa ni qooddatu; sanada tokko isaan waliin qooduus dandeessu.',
            ),
          ],
        },
        {
          id: 'problem',
          q: 'Dogoggora argadheera ykn wanti tokko hin hojjetu.',
          a: [
            p(
              'Gara [[email]] barreessaatii maal gochaa akka turtan, maal eegdan fi maal akka ta’e nutti himaa. Suuraan agarsiisu ni gargaara. Maaloo jecha icciitii keessan gonkumaa hin ergiinaa.',
            ),
          ],
        },
      ],
    },
  ],
}
