import { esc } from '../lib/dom.js';
import { store } from '../lib/store.js';
import { BRAND } from '../config.js';
import { topbar } from '../components/bits.js';
import { setTitle } from '../router.js';

const UPDATED = '16 October 2026';

const contact = () => {
  const email = String(store.get().settings?.supportEmail || '').trim();
  return email
    ? `Email us at <a href="mailto:${esc(email)}">${esc(email)}</a> or use the support options inside ${esc(BRAND.name)}.`
    : `Contact us through the support options inside ${esc(BRAND.name)}.`;
};

const DOCS = {
  '/privacy': {
    title: 'Privacy Policy',
    sub: 'How we handle your personal data',
    sections: [
      {
        h: 'Who we are',
        p: [
          `${BRAND.name} is an online campus marketplace for students, staff and sellers of ${BRAND.campus}, in Cross River State, Nigeria. In this policy, "we", "us" and "our" mean ${BRAND.name}.`,
          'This policy explains what personal data we collect, why we collect it, who sees it, how long we keep it and what choices you have. We handle personal data in line with the Nigeria Data Protection Act 2023 (NDPA).'
        ]
      },
      {
        h: 'Information we collect',
        ul: [
          'Account details: your name, email address and role (customer or vendor). If you sign in with Google, we receive your name, email and profile picture from Google. Passwords are handled by Firebase Authentication and are never visible to us.',
          'Profile details you choose to add: store name, bio, WhatsApp number, Instagram handle, department, level, and profile and banner pictures.',
          'Listings and activity: listing titles, descriptions, prices, photos and categories, items you save, reviews you write, reports you send and notifications you receive.',
          'Usage and security data: pages viewed, listing views, taps on the WhatsApp button, device and browser type, and IP address and logs used to keep the service secure and to prevent abuse.'
        ]
      },
      {
        h: 'How we use your information',
        ul: [
          'To create and manage your account and keep you signed in.',
          'To show listings and seller profiles and to let buyers contact sellers on WhatsApp.',
          'To review listings and reports, enforce our rules and protect users from fraud and abuse.',
          'To send you notifications, announcements and messages about your account or listings.',
          'To understand how the service is used so we can fix problems and improve it.',
          'To meet our legal obligations.'
        ]
      },
      {
        h: 'Our legal basis',
        p: ['We process your personal data where it is necessary to provide the service you asked for, where you have given consent (for example, when you add a public WhatsApp number or sign in with Google), where we have a legitimate interest in running and protecting the marketplace, and where the law requires it. You can withdraw consent at any time.']
      },
      {
        h: 'What other people can see',
        p: ['Listings, store names, profile pictures, ratings and reviews are public. If you add a WhatsApp number or Instagram handle to your profile or listings, anyone who visits can see it, because that is how buyers reach you. Your email address is not shown publicly. Only add contact details you are comfortable sharing.']
      },
      {
        h: 'Who we share data with',
        p: [
          'We do not sell your personal data. We use trusted service providers who process data on our behalf: Google Firebase (sign-in), Cloudinary (image storage and delivery), Neon (database), Render (server hosting) and Vercel (website hosting). Fonts are loaded from Google Fonts.',
          'We may disclose information when the law requires it, to respond to valid requests from authorities, or to protect the safety and rights of our users and the service.'
        ]
      },
      {
        h: 'Transfers outside Nigeria',
        p: ['Some of our providers store or process data on servers outside Nigeria. Where this happens, we rely on providers that apply appropriate security and data protection safeguards, as the NDPA requires.']
      },
      {
        h: 'How long we keep your data',
        p: ['We keep your data while your account is active. If you delete your account, we delete or anonymise your personal data within a reasonable time, except where we must keep certain records for security, dispute handling or legal reasons, such as moderation and audit logs.']
      },
      {
        h: 'How we protect your data',
        p: ['We use encrypted connections (HTTPS), verified sign-in tokens, access controls and limited administrator access. No online service is completely secure, so please use a strong, unique password and tell us straight away if you think your account has been misused.']
      },
      {
        h: 'Your rights',
        p: ['Under the NDPA you have the right to access your personal data, correct it, ask us to delete it, restrict or object to how we use it, withdraw your consent and receive a copy of your data. We respond to requests within one month. If you are unhappy with how we handle your data, you can complain to the Nigeria Data Protection Commission (NDPC).']
      },
      {
        h: 'Children',
        p: [`${BRAND.name} is meant for people aged 18 and over. If you are younger, you may use it only with the consent and supervision of a parent or guardian. If you believe a child has given us personal data without that consent, contact us and we will remove it.`]
      },
      {
        h: 'Cookies and local storage',
        p: ['We use your browser\'s storage and a service worker to keep you signed in, remember your preferences and help the app load faster. We do not use advertising or cross-site tracking cookies. Sponsored banners on the home screen are placed by us.']
      },
      {
        h: 'Changes to this policy',
        p: ['We may update this policy from time to time. We will change the date at the top and, for important changes, tell you in the app.']
      },
      { h: 'Contact us', html: () => `<p>For questions or to use your rights, ${contact()}</p>` }
    ]
  },
  '/terms': {
    title: 'Terms and Conditions',
    sub: 'The rules for using Ludek Market',
    sections: [
      {
        h: 'Agreeing to these terms',
        p: [`By creating an account or using ${BRAND.name}, you agree to these Terms and Conditions, our Privacy Policy and our User Agreement. If you do not agree, please do not use the service.`]
      },
      {
        h: 'What we provide',
        p: [`${BRAND.name} is a platform that helps students and sellers at ${BRAND.campus} advertise goods and services and find each other. We are not the buyer or seller in any deal. We do not process payments, deliver items, hold money for you or guarantee any item, service or person.`]
      },
      {
        h: 'Eligibility and accounts',
        ul: [
          'You must be 18 or older, or have the consent of a parent or guardian.',
          'Give accurate information and keep it up to date. Use one account only.',
          'Keep your password safe. You are responsible for everything done through your account.',
          'We may ask you to verify your identity or details before you can sell.'
        ]
      },
      {
        h: 'Listings',
        ul: [
          'Describe items and services honestly, use your own photos and list the real price in naira.',
          'Only list what you own or are allowed to sell, and remove or mark listings as sold when they are no longer available.',
          'Listings may be reviewed before they appear. We can edit, reject, hide or remove any listing at our discretion, for example if it breaks these terms or is reported.',
          'Do not post duplicate or misleading listings or use the platform for spam.'
        ]
      },
      {
        h: 'What is not allowed',
        ul: [
          'Anything illegal under Nigerian law, including stolen, counterfeit or pirated goods.',
          'Weapons, illegal drugs, harmful chemicals, and any other dangerous or restricted items.',
          'Adult content and anything that exploits or endangers others.',
          'Exam papers, impersonation or other services that help people cheat in school.',
          'Fraud, scams, fake reviews, false identities and misleading offers.',
          'Harassment, threats, hate speech or sharing other people\'s private information.',
          'Attempts to hack, overload, copy or misuse the service or its data.'
        ]
      },
      {
        h: 'Dealing with other users',
        p: [
          'Any deal is between you and the other person. Inspect items before you pay, meet in public places on campus during the day, and avoid paying in advance to people you do not know.',
          'We do not take part in transactions and are not responsible for refunds, returns or disputes. Please report suspicious listings or behaviour using the report options in the app.'
        ]
      },
      {
        h: 'Fees',
        p: [`${BRAND.name} is currently free to use. We may introduce paid features, such as promoted listings, and will tell you before any fee applies.`]
      },
      {
        h: 'Sponsored content',
        p: ['Banners marked as sponsored are advertisements. We do not guarantee or endorse the advertiser\'s products or services.']
      },
      {
        h: 'Your content',
        p: ['You own the content you post. By posting it, you give us a free, non-exclusive licence to store, display, reproduce and promote it in connection with the service. You confirm you have the right to post it and that it does not break anyone\'s rights or the law.']
      },
      {
        h: 'Our property',
        p: [`The ${BRAND.name} name, logo, design and software belong to us. You may not copy, sell or reuse them without our written permission.`]
      },
      {
        h: 'Reviews and ratings',
        p: ['Reviews must be honest and based on real experience. We may remove reviews that are fake, abusive or unrelated to the item or seller.']
      },
      {
        h: 'Suspension and ending your account',
        p: ['We may warn, limit, suspend or permanently close an account that breaks these terms, puts others at risk or harms the service. You can stop using the service or ask us to delete your account at any time.']
      },
      {
        h: 'Disclaimers',
        p: ['The service is provided "as is" and "as available". We do not check every listing or user, and we do not promise that the service will always be available or free from errors.']
      },
      {
        h: 'Limits on our liability',
        p: ['To the extent the law allows, we are not liable for losses that come from deals between users, for content posted by users, or for indirect or consequential losses. Nothing in these terms limits liability that cannot be limited under Nigerian law.']
      },
      {
        h: 'Governing law',
        p: ['These terms are governed by the laws of the Federal Republic of Nigeria. We encourage you to contact us first so we can try to resolve any complaint. If that fails, the courts of Cross River State, Nigeria, have jurisdiction.']
      },
      {
        h: 'Changes to these terms',
        p: ['We may update these terms. The date at the top shows when they last changed. If you keep using the service after a change, you accept the new terms.']
      },
      { h: 'Contact us', html: () => `<p>Questions about these terms? ${contact()}</p>` }
    ]
  },
  '/user-agreement': {
    title: 'User Agreement',
    sub: 'Rules for buyers, sellers and the community',
    sections: [
      {
        h: 'About this agreement',
        p: ['This agreement sets out how members are expected to behave. It works together with our Terms and Conditions and Privacy Policy. By creating an account, posting a listing or contacting a seller, you accept it.']
      },
      {
        h: 'For everyone',
        ul: [
          'Be honest, respectful and use your real identity.',
          'No harassment, threats, hate speech or sexual content.',
          'Respect privacy. Do not share other people\'s phone numbers, photos or messages without their permission.',
          'Follow campus rules and Nigerian law when you buy, sell or offer services.',
          'Do not use the platform to cheat in exams or assessments.'
        ]
      },
      {
        h: 'If you sell (vendors)',
        ul: [
          'Describe your item or service accurately and show real photos.',
          'Honour the price you list, and keep availability up to date. Mark items as sold.',
          'Reply to buyers promptly on WhatsApp and be clear about price, condition and where to meet.',
          'Deliver what you promised. Do not pressure buyers.',
          'Food sellers must keep to proper hygiene. Hostel listings must be genuine and you must be allowed to offer them.',
          'Services such as tutoring, design or repairs must be real services you can provide.'
        ]
      },
      {
        h: 'If you buy (customers)',
        ul: [
          'Read the listing and ask questions before you commit.',
          'Inspect the item before you pay and confirm the details with the seller.',
          'Pay the agreed amount and keep your side of the deal.',
          'Do not send fake enquiries, waste sellers\' time or haggle abusively.',
          'Leave honest reviews.'
        ]
      },
      {
        h: 'Stay safe',
        ul: [
          'Meet in busy public places on campus, in daylight if you can.',
          'Bring a friend for expensive items.',
          'Avoid paying in advance to someone you do not know.',
          'If something feels wrong, walk away and report it.'
        ]
      },
      {
        h: 'Verified badge',
        p: ['A Verified badge means we have checked some of a seller\'s details. It is not a guarantee of quality or of any item, so please still take care when you deal with anyone.']
      },
      {
        h: 'Reports and enforcement',
        p: [
          'Use the report option on a listing or profile if something breaks these rules. We review reports and may remove listings, warn members, suspend accounts or permanently close them. Serious cases may be passed to campus authorities or law enforcement.',
          'If you think we made a mistake, contact support and we will look at it again.'
        ]
      },
      {
        h: 'Disagreements between users',
        p: ['Please try to settle disagreements directly and politely. We may help where we can, but we are not responsible for deals between users and we do not give refunds.']
      },
      {
        h: 'Your account',
        p: ['You are responsible for what happens on your account. Do not share your login, and tell us if you think someone else is using it.']
      },
      {
        h: 'Changes',
        p: ['We may update this agreement from time to time. The date at the top shows when it last changed.']
      },
      { h: 'Contact us', html: () => `<p>Questions about this agreement? ${contact()}</p>` }
    ]
  }
};

const LINKS = [
  ['/privacy', 'Privacy Policy'],
  ['/terms', 'Terms and Conditions'],
  ['/user-agreement', 'User Agreement']
];

const section = item => `
  <section>
    <h2>${esc(item.h)}</h2>
    ${(item.p || []).map(text => `<p>${esc(text)}</p>`).join('')}
    ${item.ul ? `<ul>${item.ul.map(text => `<li>${esc(text)}</li>`).join('')}</ul>` : ''}
    ${item.html ? item.html() : ''}
  </section>`;

export default function legal(root, { path }) {
  const doc = DOCS[path.replace(/\/+$/, '')] || DOCS['/terms'];
  setTitle(doc.title);
  root.innerHTML = `
    ${topbar({ title: doc.title, sub: doc.sub })}
    <article class="legal pad">
      <nav class="legal-tabs" aria-label="Legal documents">
        ${LINKS.map(([href, label]) => `<a class="pill ${href === path ? 'on' : ''}" href="${href}">${esc(label)}</a>`).join('')}
      </nav>
      <p class="legal-date">Last updated: ${UPDATED}</p>
      ${doc.sections.map(section).join('')}
    </article>`;
}
