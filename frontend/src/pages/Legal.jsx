import { Link } from 'react-router-dom'
import Seo from '../components/Seo.jsx'

const CONTACT_EMAIL = 'engrmumtazali01@gmail.com'   // TODO: replace with your real address
const UPDATED = 'October 22, 2026'

function Doc({ title, description, path, children, updated = true }) {
  return (
    <div className="wrap pad">
      <Seo title={title} description={description} path={path} />
      <div className="card pad-card" style={{ maxWidth: 820, margin: '0 auto', lineHeight: 1.7 }}>
        <h1 style={{ fontSize: 34, marginBottom: 6 }}>{title}</h1>
        {updated && <p className="muted small" style={{ marginBottom: 22 }}>Last updated: {UPDATED}</p>}
        {children}
      </div>
    </div>
  )
}
const H = ({ children }) => <h2 style={{ fontSize: 21, margin: '26px 0 8px' }}>{children}</h2>
const P = ({ children }) => <p style={{ marginBottom: 12 }}>{children}</p>
const Mail = () => <a className="link" href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>

export function About() {
  return (
    <Doc title="About JobBoard" path="/about" updated={false}
      description="JobBoard helps job seekers in Pakistan find jobs from verified employers and trusted sources, and helps employers hire faster.">
      <P>JobBoard is a job search platform built for Pakistan. We bring together jobs posted directly by employers and openings collected from trusted job sources, so you can search in one place.</P>
      <H>For job seekers</H>
      <P>Search by title, company or city, save jobs, apply to employer listings, message employers and read company reviews. Creating a profile is free.</P>
      <H>For employers</H>
      <P>Post a job in minutes, review candidates, update their status and message them directly. Every employer job is reviewed by our team before it goes live.</P>
      <H>Where our jobs come from</H>
      <P>Some listings are posted by employers on JobBoard. Others are collected through official APIs and public feeds of other job sources; those listings link to the original site where you apply. We do not scrape sites that forbid it.</P>
      <P>Questions? <Link className="link" to="/contact">Contact us</Link>.</P>
    </Doc>
  )
}

export function Contact() {
  return (
    <Doc title="Contact us" path="/contact" updated={false} description="Contact the JobBoard team for support, employer enquiries or to report a job.">
      <P>We read every message and usually reply within two working days.</P>
      <H>Email</H>
      <P><Mail /></P>
      <H>What to include</H>
      <P>For support, tell us the email you registered with. To report a job, include its link. If you believe a listing is a scam or asks job seekers for money, please tell us immediately and we will remove it.</P>
    </Doc>
  )
}

export function Privacy() {
  return (
    <Doc title="Privacy Policy" path="/privacy" description="How JobBoard collects, uses and protects your personal information.">
      <P>This policy explains what information JobBoard collects, how we use it and the choices you have. By using the site you agree to it.</P>
      <H>Information we collect</H>
      <P><strong>Account data:</strong> your email, name and a hashed password. If you sign in with Google, we receive your verified email and name from Google; we never see your Google password.</P>
      <P><strong>Profile and application data:</strong> phone number, city, resume link, job preferences, cover letters, saved jobs, applications and messages you send through the site.</P>
      <P><strong>Employer data:</strong> company name, website, description and the jobs you post.</P>
      <P><strong>Technical data:</strong> basic logs such as IP address, browser type and pages visited, used for security and to keep the service running.</P>
      <H>How we use it</H>
      <P>To run your account, show your applications to the employers you apply to, send notifications and messages, review and moderate listings, prevent abuse and improve the site. If you turn on "Employers can find you" in your profile, employers may see your profile details.</P>
      <H>Who can see your information</H>
      <P>Employers see the application details you submit to their jobs. We do not sell your personal information. We use service providers (hosting, database, email delivery) who process data on our behalf, and we may disclose data if required by law.</P>
      <H>Cookies, local storage and advertising</H>
      <P>We store a sign-in token in your browser so you stay logged in. We may show ads from third parties such as Google AdSense. These providers may use cookies to show ads based on your visits to this and other websites. You can manage ad personalisation at <a className="link" href="https://adssettings.google.com" target="_blank" rel="noopener noreferrer">adssettings.google.com</a>.</P>
      <H>Third-party job listings</H>
      <P>Some jobs link to other websites. Those sites have their own privacy policies and we are not responsible for them.</P>
      <H>Data retention and your rights</H>
      <P>You can edit your profile, withdraw applications and hide your profile at any time. To delete your account and data, email <Mail />. We keep some records where we are legally required to.</P>
      <H>Security</H>
      <P>Passwords are stored hashed and traffic is encrypted over HTTPS. No system is perfectly secure, so please use a strong, unique password.</P>
      <H>Children</H>
      <P>JobBoard is not intended for people under 16.</P>
      <H>Changes and contact</H>
      <P>We may update this policy and will change the date above when we do. Questions: <Mail />.</P>
    </Doc>
  )
}

export function Terms() {
  return (
    <Doc title="Terms of Service" path="/terms" description="The rules for using JobBoard as a job seeker or employer.">
      <P>By creating an account or using JobBoard you agree to these terms.</P>
      <H>Using the site</H>
      <P>You must give accurate information, keep your password safe and be at least 16 years old. You are responsible for activity on your account. Do not misuse the site, attempt to break its security, or collect data from it automatically without permission.</P>
      <H>Job seekers</H>
      <P>JobBoard is a platform that connects you with employers. We do not guarantee any job, interview or response, and we are not your employer or recruiter. Never pay money to get a job. Report any listing that asks you to.</P>
      <H>Employers</H>
      <P>Job posts must be real, lawful, accurate and not discriminatory. Do not post jobs that charge applicants fees, promote scams, or collect personal data for other purposes. We may review, edit, reject or remove any listing and suspend accounts that break these rules. Any paid features, when offered, are described at the time of purchase.</P>
      <H>Reviews and user content</H>
      <P>Reviews and messages must be honest and respectful, with no hate speech, harassment or private information about others. You keep ownership of what you post but give us permission to display it on the site. We may remove content that breaks these rules.</P>
      <H>Third-party listings</H>
      <P>Some jobs come from other websites. We do not control or verify them and are not responsible for their accuracy or for what happens on those sites.</P>
      <H>Disclaimer and liability</H>
      <P>The service is provided "as is" without warranties. To the extent permitted by law, JobBoard is not liable for indirect or consequential losses arising from your use of the site or from dealings with employers or job seekers.</P>
      <H>Termination and changes</H>
      <P>We may suspend or close accounts that break these terms. You can stop using the site at any time. We may update these terms and the date above will change when we do. Continued use means you accept the changes.</P>
      <H>Contact</H>
      <P><Mail /></P>
    </Doc>
  )
}