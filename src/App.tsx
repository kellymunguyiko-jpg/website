import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Menu, X, Globe, LayoutDashboard, ChevronDown,
  Home, FolderOpen, ShoppingCart, Info, Mail,
  Check, Star, Zap, Shield, ArrowRight,
  BarChart3, Users, HardDrive, Plus, Settings,
  Layers, Send, MapPin, Phone,
  Monitor, Smartphone, Code, Palette, BookOpen, Heart,
  TrendingUp, Clock, ChevronRight,
  Image, Type, FileText, Eye, ExternalLink, Trash2, Edit3,
  Upload, ArrowLeft, CheckCircle2, Crown, Sparkles, Link2,
  UserPlus, Ban, UserCheck, Copy, LogOut, Link, Key, Search, Download, Laptop
  , Bell, MessageSquare
} from 'lucide-react';
import { collection, addDoc, getDocs, deleteDoc, doc, query, orderBy, Timestamp, updateDoc, where, onSnapshot, setDoc } from 'firebase/firestore';
import { initializeApp, getApps } from 'firebase/app';
import { createUserWithEmailAndPassword, getAuth, signOut as signOutSecondary, updateProfile as updateSecondaryProfile } from 'firebase/auth';
import { db } from './firebase';
import { AuthProvider, useAuth } from './AuthContext';
import LoginPage from './LoginPage';
import AIChat from './AIChat';
import VoiceAI from './VoiceAI';

interface ProjectItem {
  id: string;
  title: string;
  desc: string;
  tag: string;
  image: string | null;
  link?: string;
  price?: string;
  placement?: 'project' | 'sale' | 'both';
  createdBy: string;
  createdAt: string;
}

interface ContactMessage {
  id: string;
  name: string;
  email: string;
  message: string;
  reply?: string;
  status: 'new' | 'replied';
  createdAt: string;
}

interface BuyWebsiteItem {
  id: string;
  title: string;
  desc: string;
  category: string;
  price: string;
  image: string;
  link: string;
  createdBy: string;
  createdAt: string;
}

interface YouTubeAdItem {
  id: string;
  url: string;
  videoId: string;
  title: string;
  thumbnail?: string;
  createdBy: string;
  createdAt: string;
}

interface ContactInfoItem {
  email: string;
  phone: string;
  location: string;
}

interface DownloadLinksItem {
  apk: string;
  windows: string;
}

const YOUTUBE_API_KEY = 'AIzaSyAlom__4hjOxCv6ln9L3J6i4_afjoM5Cl0';

function getYouTubeVideoId(url: string) {
  const trimmed = url.trim();
  try {
    const parsed = new URL(trimmed);
    const host = parsed.hostname.replace('www.', '').replace('m.', '');
    if (host === 'youtube.com' && parsed.searchParams.get('v')) return parsed.searchParams.get('v') || '';
    if (host === 'youtu.be') return parsed.pathname.replace('/', '').split('/')[0] || '';
    if (host === 'youtube.com') {
      const parts = parsed.pathname.split('/').filter(Boolean);
      if ((parts[0] === 'embed' || parts[0] === 'shorts' || parts[0] === 'live') && parts[1]) return parts[1];
    }
  } catch {
    // Fall back to regex parsing below.
  }
  const patterns = [
    /(?:youtube\.com\/watch\?v=)([a-zA-Z0-9_-]{6,})/,
    /(?:youtu\.be\/)([a-zA-Z0-9_-]{6,})/,
    /(?:youtube\.com\/embed\/)([a-zA-Z0-9_-]{6,})/,
    /(?:youtube\.com\/shorts\/)([a-zA-Z0-9_-]{6,})/,
  ];
  for (const pattern of patterns) {
    const match = trimmed.match(pattern);
    if (match?.[1]) return match[1];
  }
  return '';
}

async function fetchYouTubeVideo(videoId: string) {
  const response = await fetch(`https://www.googleapis.com/youtube/v3/videos?part=snippet&id=${videoId}&key=${YOUTUBE_API_KEY}`);
  if (!response.ok) throw new Error('YouTube API request failed');
  const data = await response.json();
  const item = data.items?.[0];
  if (!item) throw new Error('Video not found');
  return {
    title: item.snippet?.title || 'WebCraft YouTube Ad',
    thumbnail: item.snippet?.thumbnails?.high?.url || item.snippet?.thumbnails?.medium?.url || item.snippet?.thumbnails?.default?.url || '',
  };
}

const firebaseConfigForSecondary = {
  apiKey: 'AIzaSyBh5Jrwp53NS4n4_W4Q1Zssh2kqTz0sWBA',
  authDomain: 'webcraft-6e3ba.firebaseapp.com',
  projectId: 'webcraft-6e3ba',
  storageBucket: 'webcraft-6e3ba.firebasestorage.app',
  messagingSenderId: '49475677388',
  appId: '1:49475677388:web:41c80bb4d4e4f7d2636669',
  measurementId: 'G-TN8N3L8TVL',
};

async function uploadToCloudinary(file: File) {
  const data = new FormData();
  data.append('file', file);
  data.append('upload_preset', 'kellyseek');
  const response = await fetch('https://api.cloudinary.com/v1_1/da6zjy3ix/image/upload', {
    method: 'POST',
    body: data,
  });
  if (!response.ok) throw new Error('Cloudinary upload failed');
  const result = await response.json();
  return result.secure_url as string;
}

type Language = 'en' | 'rw' | 'zh';
type DashView = 'overview' | 'create' | 'sites' | 'analytics' | 'settings' | 'plans' | 'users' | 'contacts' | 'adminInvite' | 'uploadProjects' | 'sellWebsites' | 'youtubeAds';
type PlanType = 'free' | 'premium' | 'vip';

interface Site {
  id: string;
  name: string;
  description: string;
  image: string | null;
  plan: PlanType;
  status: 'active' | 'paused';
  createdAt: string;
  ownerId?: string;
  ownerName?: string;
  ownerEmail?: string;
}

const translations: Record<Language, Record<string, string>> = {
  en: {
    brand: 'WebCraft', home: 'Home', projects: 'Projects', buy: 'Buy', about: 'About', contact: 'Contact', dashboard: 'Dashboard',
    heroTitle: 'Build Your Dream Website', heroSub: 'Create stunning, professional websites with powerful tools. Choose your plan and launch your online presence today.',
    getStarted: 'Get Started', viewPricing: 'View Pricing',
    pricingTitle: 'Choose Your Plan', pricingSub: 'Select the perfect plan for your needs. Upgrade anytime as your business grows.',
    free: 'Free', premium: 'Premium', vip: 'VIP',
    freeP: '$0', premP: '$50', vipP: '$110',
    freeD: '/30 days', premD: '/year', vipD: '/year',
    f1: '30 Days Free Trial', f2: 'No SEO Tools', f3: 'Can Be Paused', f4: 'Basic Templates', f5: 'Community Support', fDomain: '.edgeone.app or .netlify.app Domain', fWatermark: '"kellyseekhelp" Watermark',
    p1: 'Unlimited SEO', p2: '1 Year Before Pause', p3: 'Premium Templates', p4: 'Priority Support', p5: '.com Domain', pWatermark: '"kellyseekhelp" Watermark',
    v1: 'Unlimited SEO', v2: 'Never Paused', v3: 'All Premium Features', v4: '.com or .rw Domain', v5: '24/7 VIP Support', v6: 'Advanced Analytics', vNoWatermark: 'No Watermark',
    choosePlan: 'Choose Plan', mostPopular: 'Most Popular', bestValue: 'Best Value',
    projectsTitle: 'Our Projects', projectsSub: 'Explore our portfolio of stunning websites built for clients worldwide.',
    buyTitle: 'Get Your Website', buySub: 'Choose a category and start building your website today.',
    cat1: 'E-Commerce', cat2: 'Portfolio', cat3: 'Blog', cat4: 'Business', cat5: 'Education', cat6: 'Health & Fitness',
    selectCat: 'Select Category', startBuild: 'Start Building',
    aboutTitle: 'About WebCraft', aboutSub: 'We are passionate about helping businesses and individuals create powerful online presences.',
    aboutDesc: 'WebCraft is a leading website builder platform that empowers users to create professional websites without coding knowledge. Our mission is to make web development accessible to everyone.',
    contactTitle: 'Get In Touch', contactSub: 'Have questions? We would love to hear from you.',
    name: 'Full Name', email: 'Email Address', msg: 'Your Message', send: 'Send Message',
    dashWelcome: 'Welcome back', dashTitle: 'Dashboard', dashSites: 'Active Sites', dashStorage: 'Storage Used',
    dashVisitors: 'Total Visitors', dashPlan: 'Current Plan', dashActivity: 'Recent Activity', dashQuick: 'Quick Actions',
    createNew: 'Create New Site', manageSites: 'My Sites', viewAnalytics: 'Analytics', settings: 'Settings',
    trial: 'Trial', perYear: 'per year',
    overview: 'Overview', plans: 'Plans & Billing', createSite: 'Create New Site',
    siteName: 'Site Name', siteDesc: 'Site Description', siteImage: 'Site Image', uploadImage: 'Upload Image',
    dragDrop: 'Drag & drop an image here, or click to browse', imagePreview: 'Image Preview',
    publishSite: 'Publish Site', siteNamePh: 'My Awesome Website', siteDescPh: 'Describe your website...',
    selectPlan: 'Select Plan', yourSites: 'Your Websites', noSites: 'No websites yet. Create your first one!',
    active: 'Active', paused: 'Paused', pause: 'Pause', resume: 'Resume', edit: 'Edit', delete: 'Delete',
    viewSite: 'View Site', backToDash: 'Back to Dashboard', domain: 'Domain',
    changePlan: 'Change Plan', currentPlan: 'Current Plan', upgrade: 'Upgrade', downgrade: 'Downgrade',
    seoStatus: 'SEO Status', noSeo: 'No SEO', unlimitedSeo: 'Unlimited SEO',
    pauseInfo: 'Pause Info', canPause: 'Can be paused', pause1yr: 'Pause up to 1 year', neverPause: 'Never paused',
    analytics: 'Analytics', totalViews: 'Total Views', uniqueVisitors: 'Unique Visitors', bounceRate: 'Bounce Rate', avgTime: 'Avg. Time',
    generalSettings: 'General Settings', displayName: 'Display Name', saveChanges: 'Save Changes',
    watermark: 'Watermark', hasWatermark: 'Has Watermark', noWatermark: 'No Watermark',
  },
  rw: {
    brand: 'WebCraft', home: 'Ahabanza', projects: 'Imishinga', buy: 'Gura', about: 'Abo Turibo', contact: 'Twandikire', dashboard: 'Ikibaho',
    heroTitle: 'Kubaka Urubuga Rwawe', heroSub: 'Kora urubuga rwiza kandi rwumwuga hamwe nibikoresho bikomeye. Hitamo gahunda yawe.',
    getStarted: 'Tangira', viewPricing: 'Reba Ibiciro',
    pricingTitle: 'Hitamo Gahunda Yawe', pricingSub: 'Hitamo gahunda nziza kubyo ukeneye.',
    free: 'Ubuntu', premium: 'Premium', vip: 'VIP',
    freeP: '$0', premP: '$50', vipP: '$110',
    freeD: '/iminsi 30', premD: '/umwaka', vipD: '/umwaka',
    f1: 'Iminsi 30 Kubuntu', f2: 'Nta SEO', f3: 'Irashobora Guhagarikwa', f4: 'Inyandikorugero zibanze', f5: 'Ubufasha bwabaturage', fDomain: '.edgeone.app cyangwa .netlify.app Domain', fWatermark: 'Ikimenyetso "kellyseekhelp"',
    p1: 'SEO Ntamipaka', p2: 'Umwaka 1 Mbere yo Guhagarika', p3: 'Inyandikorugero za Premium', p4: 'Ubufasha Bwihutirwa', p5: '.com Domain', pWatermark: 'Ikimenyetso "kellyseekhelp"',
    v1: 'SEO Ntamipaka', v2: 'Ntihagarikwa', v3: 'Ibintu Byose bya Premium', v4: '.com cyangwa .rw Domain', v5: 'Ubufasha VIP 24/7', v6: 'Isesengura Ryimbitse', vNoWatermark: 'Nta Kimenyetso',
    choosePlan: 'Hitamo Gahunda', mostPopular: 'Izwi Cyane', bestValue: 'Agaciro Keza',
    projectsTitle: 'Imishinga Yacu', projectsSub: 'Reba portfolio yacu yimbuga nziza zubatswe kubakiriya kwisi yose.',
    buyTitle: 'Kubona Urubuga Rwawe', buySub: 'Hitamo icyiciro maze utangire kubaka urubuga rwawe.',
    cat1: 'Ubucuruzi Bwumurongo', cat2: 'Portfolio', cat3: 'Blog', cat4: 'Ubucuruzi', cat5: 'Uburezi', cat6: 'Ubuzima & Siporo',
    selectCat: 'Hitamo Icyiciro', startBuild: 'Tangira Kubaka',
    aboutTitle: 'Abo Turibo - WebCraft', aboutSub: 'Dufite ishyaka ryo gufasha ubucuruzi n\'abantu gukora imbuga zikomeye.',
    aboutDesc: 'WebCraft ni urubuga rukomeye rwo kubaka imbuga rutuma abantu bashobora gukora imbuga zumwuga badakeneye ubumenyi bwo gukoda.',
    contactTitle: 'Twandikire', contactSub: 'Ufite ibibazo? Twakwishimira kukumva.',
    name: 'Amazina Yuzuye', email: 'Aderesi ya Imeri', msg: 'Ubutumwa Bwawe', send: 'Ohereza Ubutumwa',
    dashWelcome: 'Murakaza neza', dashTitle: 'Ikibaho', dashSites: 'Imbuga Zikora', dashStorage: 'Ubwizigame',
    dashVisitors: 'Abashyitsi Bose', dashPlan: 'Gahunda Yubu', dashActivity: 'Ibikorwa Biheruka', dashQuick: 'Ibikorwa Byihuse',
    createNew: 'Kora Urubuga Rushya', manageSites: 'Imbuga Zanjye', viewAnalytics: 'Isesengura', settings: 'Igenamiterere',
    trial: 'Igerageza', perYear: 'ku mwaka',
    overview: 'Incamake', plans: 'Gahunda & Kwishyura', createSite: 'Kora Urubuga Rushya',
    siteName: 'Izina ry\'Urubuga', siteDesc: 'Ibisobanuro', siteImage: 'Ifoto y\'Urubuga', uploadImage: 'Shyiraho Ifoto',
    dragDrop: 'Kurura ifoto hano, cyangwa kanda uhitemo', imagePreview: 'Ifoto',
    publishSite: 'Tangaza Urubuga', siteNamePh: 'Urubuga Rwanjye', siteDescPh: 'Sobanura urubuga rwawe...',
    selectPlan: 'Hitamo Gahunda', yourSites: 'Imbuga Zawe', noSites: 'Nta mbuga ufite. Kora iya mbere!',
    active: 'Ikora', paused: 'Yahagaritswe', pause: 'Hagarika', resume: 'Komeza', edit: 'Hindura', delete: 'Siba',
    viewSite: 'Reba Urubuga', backToDash: 'Subira ku Kibaho', domain: 'Domain',
    changePlan: 'Hindura Gahunda', currentPlan: 'Gahunda Yubu', upgrade: 'Zamura', downgrade: 'Manura',
    seoStatus: 'Imiterere ya SEO', noSeo: 'Nta SEO', unlimitedSeo: 'SEO Ntamipaka',
    pauseInfo: 'Amakuru yo Guhagarika', canPause: 'Irashobora guhagarikwa', pause1yr: 'Hagarika kugeza ku mwaka 1', neverPause: 'Ntihagarikwa',
    analytics: 'Isesengura', totalViews: 'Ibyarebwe Byose', uniqueVisitors: 'Abashyitsi Bihariye', bounceRate: 'Igipimo cyo Gusubira', avgTime: 'Igihe Gisanzwe',
    generalSettings: 'Igenamiterere Rusange', displayName: 'Izina Rigaragara', saveChanges: 'Bika Impinduka',
    watermark: 'Ikimenyetso', hasWatermark: 'Ifite Ikimenyetso', noWatermark: 'Nta Kimenyetso',
  },
  zh: {
    brand: 'WebCraft', home: '\u9996\u9875', projects: '\u9879\u76ee', buy: '\u8d2d\u4e70', about: '\u5173\u4e8e', contact: '\u8054\u7cfb', dashboard: '\u4eea\u8868\u677f',
    heroTitle: '\u6784\u5efa\u60a8\u7684\u68a6\u60f3\u7f51\u7ad9', heroSub: '\u4f7f\u7528\u5f3a\u5927\u7684\u5de5\u5177\u521b\u5efa\u4ee4\u4eba\u60ca\u53f9\u7684\u4e13\u4e1a\u7f51\u7ad9\u3002',
    getStarted: '\u5f00\u59cb\u4f7f\u7528', viewPricing: '\u67e5\u770b\u4ef7\u683c',
    pricingTitle: '\u9009\u62e9\u60a8\u7684\u8ba1\u5212', pricingSub: '\u9009\u62e9\u6700\u9002\u5408\u60a8\u9700\u6c42\u7684\u8ba1\u5212\u3002',
    free: '\u514d\u8d39\u7248', premium: '\u9ad8\u7ea7\u7248', vip: 'VIP\u7248',
    freeP: '$0', premP: '$50', vipP: '$110',
    freeD: '/30\u5929', premD: '/\u5e74', vipD: '/\u5e74',
    f1: '30\u5929\u514d\u8d39\u8bd5\u7528', f2: '\u65e0SEO\u5de5\u5177', f3: '\u53ef\u4ee5\u6682\u505c', f4: '\u57fa\u7840\u6a21\u677f', f5: '\u793e\u533a\u652f\u6301', fDomain: '.edgeone.app\u6216.netlify.app\u57df\u540d', fWatermark: '"kellyseekhelp"\u6c34\u5370',
    p1: '\u65e0\u9650SEO', p2: '1\u5e74\u540e\u53ef\u6682\u505c', p3: '\u9ad8\u7ea7\u6a21\u677f', p4: '\u4f18\u5148\u652f\u6301', p5: '.com\u57df\u540d', pWatermark: '"kellyseekhelp"\u6c34\u5370',
    v1: '\u65e0\u9650SEO', v2: '\u6c38\u4e0d\u6682\u505c', v3: '\u6240\u6709\u9ad8\u7ea7\u529f\u80fd', v4: '.com\u6216.rw\u57df\u540d', v5: '24/7 VIP\u652f\u6301', v6: '\u9ad8\u7ea7\u5206\u6790', vNoWatermark: '\u65e0\u6c34\u5370',
    choosePlan: '\u9009\u62e9\u8ba1\u5212', mostPopular: '\u6700\u53d7\u6b22\u8fce', bestValue: '\u6700\u4f73\u4ef7\u503c',
    projectsTitle: '\u6211\u4eec\u7684\u9879\u76ee', projectsSub: '\u63a2\u7d22\u6211\u4eec\u4e3a\u5168\u7403\u5ba2\u6237\u6784\u5efa\u7684\u7cbe\u7f8e\u7f51\u7ad9\u7ec4\u5408\u3002',
    buyTitle: '\u83b7\u53d6\u60a8\u7684\u7f51\u7ad9', buySub: '\u9009\u62e9\u4e00\u4e2a\u7c7b\u522b\uff0c\u4eca\u5929\u5f00\u59cb\u6784\u5efa\u60a8\u7684\u7f51\u7ad9\u3002',
    cat1: '\u7535\u5b50\u5546\u52a1', cat2: '\u4f5c\u54c1\u96c6', cat3: '\u535a\u5ba2', cat4: '\u5546\u4e1a', cat5: '\u6559\u80b2', cat6: '\u5065\u5eb7\u4e0e\u5065\u8eab',
    selectCat: '\u9009\u62e9\u7c7b\u522b', startBuild: '\u5f00\u59cb\u6784\u5efa',
    aboutTitle: '\u5173\u4e8e WebCraft', aboutSub: '\u6211\u4eec\u70ed\u8877\u4e8e\u5e2e\u52a9\u4f01\u4e1a\u548c\u4e2a\u4eba\u521b\u5efa\u5f3a\u5927\u7684\u5728\u7ebf\u4e1a\u52a1\u3002',
    aboutDesc: 'WebCraft\u662f\u9886\u5148\u7684\u7f51\u7ad9\u5efa\u8bbe\u5e73\u53f0\uff0c\u4f7f\u7528\u6237\u65e0\u9700\u7f16\u7a0b\u77e5\u8bc6\u5373\u53ef\u521b\u5efa\u4e13\u4e1a\u7f51\u7ad9\u3002',
    contactTitle: '\u8054\u7cfb\u6211\u4eec', contactSub: '\u6709\u95ee\u9898\uff1f\u6211\u4eec\u5f88\u4e50\u610f\u542c\u53d6\u60a8\u7684\u610f\u89c1\u3002',
    name: '\u5168\u540d', email: '\u7535\u5b50\u90ae\u4ef6', msg: '\u60a8\u7684\u7559\u8a00', send: '\u53d1\u9001\u6d88\u606f',
    dashWelcome: '\u6b22\u8fce\u56de\u6765', dashTitle: '\u4eea\u8868\u677f', dashSites: '\u6d3b\u8dc3\u7ad9\u70b9', dashStorage: '\u5df2\u7528\u5b58\u50a8',
    dashVisitors: '\u603b\u8bbf\u5ba2', dashPlan: '\u5f53\u524d\u8ba1\u5212', dashActivity: '\u6700\u8fd1\u6d3b\u52a8', dashQuick: '\u5feb\u901f\u64cd\u4f5c',
    createNew: '\u521b\u5efa\u65b0\u7ad9\u70b9', manageSites: '\u6211\u7684\u7ad9\u70b9', viewAnalytics: '\u5206\u6790', settings: '\u8bbe\u7f6e',
    trial: '\u8bd5\u7528', perYear: '\u6bcf\u5e74',
    overview: '\u6982\u89c8', plans: '\u8ba1\u5212\u4e0e\u8d26\u5355', createSite: '\u521b\u5efa\u65b0\u7ad9\u70b9',
    siteName: '\u7ad9\u70b9\u540d\u79f0', siteDesc: '\u7ad9\u70b9\u63cf\u8ff0', siteImage: '\u7ad9\u70b9\u56fe\u7247', uploadImage: '\u4e0a\u4f20\u56fe\u7247',
    dragDrop: '\u5c06\u56fe\u7247\u62d6\u653e\u5230\u6b64\u5904\uff0c\u6216\u70b9\u51fb\u6d4f\u89c8', imagePreview: '\u56fe\u7247\u9884\u89c8',
    publishSite: '\u53d1\u5e03\u7ad9\u70b9', siteNamePh: '\u6211\u7684\u7cbe\u5f69\u7f51\u7ad9', siteDescPh: '\u63cf\u8ff0\u60a8\u7684\u7f51\u7ad9...',
    selectPlan: '\u9009\u62e9\u8ba1\u5212', yourSites: '\u60a8\u7684\u7f51\u7ad9', noSites: '\u8fd8\u6ca1\u6709\u7f51\u7ad9\u3002\u521b\u5efa\u60a8\u7684\u7b2c\u4e00\u4e2a\uff01',
    active: '\u6d3b\u8dc3', paused: '\u5df2\u6682\u505c', pause: '\u6682\u505c', resume: '\u6062\u590d', edit: '\u7f16\u8f91', delete: '\u5220\u9664',
    viewSite: '\u67e5\u770b\u7ad9\u70b9', backToDash: '\u8fd4\u56de\u4eea\u8868\u677f', domain: '\u57df\u540d',
    changePlan: '\u66f4\u6539\u8ba1\u5212', currentPlan: '\u5f53\u524d\u8ba1\u5212', upgrade: '\u5347\u7ea7', downgrade: '\u964d\u7ea7',
    seoStatus: 'SEO\u72b6\u6001', noSeo: '\u65e0SEO', unlimitedSeo: '\u65e0\u9650SEO',
    pauseInfo: '\u6682\u505c\u4fe1\u606f', canPause: '\u53ef\u4ee5\u6682\u505c', pause1yr: '\u6682\u505c\u6700\u591a1\u5e74', neverPause: '\u6c38\u4e0d\u6682\u505c',
    analytics: '\u5206\u6790', totalViews: '\u603b\u6d4f\u89c8\u91cf', uniqueVisitors: '\u72ec\u7acb\u8bbf\u5ba2', bounceRate: '\u8df3\u51fa\u7387', avgTime: '\u5e73\u5747\u65f6\u95f4',
    generalSettings: '\u5e38\u89c4\u8bbe\u7f6e', displayName: '\u663e\u793a\u540d\u79f0', saveChanges: '\u4fdd\u5b58\u66f4\u6539',
    watermark: '\u6c34\u5370', hasWatermark: '\u6709\u6c34\u5370', noWatermark: '\u65e0\u6c34\u5370',
  },
};

const langOptions = [
  { code: 'en' as Language, label: 'English', flag: '\u{1F1EC}\u{1F1E7}' },
  { code: 'rw' as Language, label: 'Kinyarwanda', flag: '\u{1F1F7}\u{1F1FC}' },
  { code: 'zh' as Language, label: '\u4e2d\u6587', flag: '\u{1F1E8}\u{1F1F3}' },
];

const planConfig: Record<PlanType, { domain: string; color: string; bgColor: string; icon: typeof Star; seo: string; pause: string; hasWatermark: boolean }> = {
  free: { domain: '.edgeone.app', color: 'text-gray-400', bgColor: 'bg-gray-500/20', icon: Shield, seo: 'noSeo', pause: 'canPause', hasWatermark: true },
  premium: { domain: '.com', color: 'text-green-400', bgColor: 'bg-green-500/20', icon: Star, seo: 'unlimitedSeo', pause: 'pause1yr', hasWatermark: true },
  vip: { domain: '.com / .rw', color: 'text-yellow-400', bgColor: 'bg-yellow-500/20', icon: Crown, seo: 'unlimitedSeo', pause: 'neverPause', hasWatermark: false },
};

function AppContent() {
  const { user, profile, loading, logout, generateAdminLink, useInviteCode, getAllUsers, suspendUser, activateUser, deleteUserAccount, getAllInviteLinks } = useAuth();
  const [lang, setLang] = useState<Language>('en');
  const [activeSection, setActiveSection] = useState('home');
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [langOpen, setLangOpen] = useState(false);
  const [showDashboard, setShowDashboard] = useState(false);
  const [showDownloadPanel, setShowDownloadPanel] = useState(false);
  const [dashView, setDashView] = useState<DashView>('overview');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedPlan, setSelectedPlan] = useState<PlanType>('free');
  const [showLogin, setShowLogin] = useState(false);
  const [roleChoice, setRoleChoice] = useState<'user' | 'admin' | 'manager'>(() => {
    const stored = typeof window !== 'undefined' ? localStorage.getItem('webcraftRoleChoice') : null;
    return stored === 'manager' || stored === 'admin' || stored === 'user' ? stored : 'user';
  });
  const [allUsers, setAllUsers] = useState<import('./AuthContext').UserProfile[]>([]);
  const [inviteLinks, setInviteLinks] = useState<import('./AuthContext').InviteLink[]>([]);
  const [generatedCode, setGeneratedCode] = useState('');
  const [inviteInput, setInviteInput] = useState('');
  const [inviteMsg, setInviteMsg] = useState('');
  const [projects, setProjects] = useState<ProjectItem[]>([]);
  const [projectSearch, setProjectSearch] = useState('');
  const [showAllProjects, setShowAllProjects] = useState(false);
  const [buyWebsites, setBuyWebsites] = useState<BuyWebsiteItem[]>([]);
  const [showAllBuyWebsites, setShowAllBuyWebsites] = useState(false);
  const [youtubeAds, setYoutubeAds] = useState<YouTubeAdItem[]>([]);
  const [newYouTubeUrl, setNewYouTubeUrl] = useState('');
  const [newYouTubeTitle, setNewYouTubeTitle] = useState('');
  const [youtubeMsg, setYoutubeMsg] = useState('');
  const [newProjectTitle, setNewProjectTitle] = useState('');
  const [newProjectDesc, setNewProjectDesc] = useState('');
  const [newProjectTag, setNewProjectTag] = useState('');
  const [newProjectImage, setNewProjectImage] = useState<string | null>(null);
  const [newProjectLink, setNewProjectLink] = useState('');
  const [projectMsg, setProjectMsg] = useState('');
  const [saleTitle, setSaleTitle] = useState('');
  const [saleDesc, setSaleDesc] = useState('');
  const [saleCategory, setSaleCategory] = useState('');
  const [salePrice, setSalePrice] = useState('');
  const [saleImage, setSaleImage] = useState('');
  const [saleLink, setSaleLink] = useState('');
  const [saleDestination, setSaleDestination] = useState<'sale' | 'project' | 'both'>('sale');
  const [saleMsg, setSaleMsg] = useState('');
  const [siteMsg, setSiteMsg] = useState('');
  const [contacts, setContacts] = useState<ContactMessage[]>([]);
  const [contactInfo, setContactInfo] = useState<ContactInfoItem>({ email: 'kellyseekhelp@gmail.com', phone: '0733536250', location: 'Kigali, Rwanda' });
  const [contactInfoMsg, setContactInfoMsg] = useState('');
  const [downloadLinks, setDownloadLinks] = useState<DownloadLinksItem>({ apk: '', windows: '' });
  const [downloadLinksMsg, setDownloadLinksMsg] = useState('');
  const [contactName, setContactName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactMessage, setContactMessage] = useState('');
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});
  const [notifyText, setNotifyText] = useState('');
  const [adminMsg, setAdminMsg] = useState('');
  const [inviteName, setInviteName] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [invitePassword, setInvitePassword] = useState('');
  const [inviteRole, setInviteRole] = useState<'user' | 'admin' | 'manager'>('user');
  const [managerAccessKey, setManagerAccessKey] = useState('');
  const [newManagerKey, setNewManagerKey] = useState('');
  const [generatedInviteKey, setGeneratedInviteKey] = useState('');
  const [sites, setSites] = useState<Site[]>([]);
  const [newSiteName, setNewSiteName] = useState('');
  const [newSiteDesc, setNewSiteDesc] = useState('');
  const [newSiteImage, setNewSiteImage] = useState<string | null>(null);
  const [newSitePlan, setNewSitePlan] = useState<PlanType>('free');
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const langRef = useRef<HTMLDivElement>(null);
  const t = translations[lang];
  const dashboardRole: 'user' | 'admin' | 'manager' = profile?.role === 'manager' || roleChoice === 'manager'
    ? 'manager'
    : profile?.role === 'admin' || roleChoice === 'admin'
      ? 'admin'
      : 'user';

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 80);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (langRef.current && !langRef.current.contains(e.target as Node)) setLangOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  useEffect(() => {
    if (user && showLogin) {
      const stored = localStorage.getItem('webcraftRoleChoice') as 'user' | 'admin' | 'manager' | null;
      if (stored === 'user' || stored === 'admin' || stored === 'manager') setRoleChoice(stored);
      setShowLogin(false);
      if (stored === 'manager' || stored === 'admin') {
        setDashView('overview');
        setShowDashboard(true);
        window.scrollTo(0, 0);
      } else {
        setShowDashboard(false);
        setActiveSection('home');
        setTimeout(() => document.getElementById('home')?.scrollIntoView({ behavior: 'smooth' }), 50);
      }
    }
  }, [user, profile, showLogin]);

  const navigate = (section: string) => {
    setActiveSection(section);
    setShowDashboard(false);
    const el = document.getElementById(section);
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  };

  const openDashboard = (view: DashView = 'overview') => {
    setShowDashboard(true);
    setDashView(view);
    window.scrollTo(0, 0);
  };

  const handleImageUpload = useCallback(async (file: File) => {
    if (file && file.type.startsWith('image/')) {
      try {
        const url = await uploadToCloudinary(file);
        setNewSiteImage(url);
      } catch {
        const reader = new FileReader();
        reader.onload = (e) => setNewSiteImage(e.target?.result as string);
        reader.readAsDataURL(file);
      }
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleImageUpload(file);
  }, [handleImageUpload]);

  const loadSites = useCallback(async () => {
    if (!user) {
      setSites([]);
      return;
    }

    try {
      const base = collection(db, 'sites');
      const q = dashboardRole === 'admin' || dashboardRole === 'manager'
        ? query(base)
        : query(base, where('ownerId', '==', user.uid));
      const snap = await getDocs(q);
      const loadedSites = snap.docs.map(d => {
        const data = d.data();
        return {
          id: d.id,
          name: data.name || '',
          description: data.description || '',
          image: data.image || null,
          plan: data.plan || 'free',
          status: data.status || 'active',
          ownerId: data.ownerId,
          ownerName: data.ownerName || '',
          ownerEmail: data.ownerEmail || '',
          createdAt: data.createdAt?.toDate ? data.createdAt.toDate().toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
        } as Site;
      }).sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
      setSites(loadedSites);
    } catch {
      setSites([]);
    }
  }, [user, dashboardRole]);

  useEffect(() => { loadSites(); }, [loadSites]);

  useEffect(() => {
    if (!user) {
      setSites([]);
      return;
    }

    const base = collection(db, 'sites');
    const sitesQuery = dashboardRole === 'admin' || dashboardRole === 'manager'
      ? query(base)
      : query(base, where('ownerId', '==', user.uid));

    const unsubscribe = onSnapshot(
      sitesQuery,
      (snapshot) => {
        const liveSites = snapshot.docs.map(d => {
          const data = d.data();
          return {
            id: d.id,
            name: data.name || '',
            description: data.description || '',
            image: data.image || null,
            plan: data.plan || 'free',
            status: data.status || 'active',
            ownerId: data.ownerId,
            ownerName: data.ownerName || '',
            ownerEmail: data.ownerEmail || '',
            createdAt: data.createdAt?.toDate ? data.createdAt.toDate().toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
          } as Site;
        }).sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
        setSites(liveSites);
      },
      () => setSites([]),
    );

    return () => unsubscribe();
  }, [user?.uid, dashboardRole]);

  const publishSite = async () => {
    if (!newSiteName.trim()) return;
    if (!siteDescriptionReady) {
      setSiteMsg(`Please write at least 2 words about the website. Current: ${siteDescriptionWords}/2 words.`);
      setDashView('create');
      return;
    }
    if (!user) {
      setShowLogin(true);
      return;
    }
    try {
      await addDoc(collection(db, 'sites'), {
        name: newSiteName,
        description: newSiteDesc,
        image: newSiteImage,
        plan: newSitePlan,
        status: 'active',
        ownerId: user.uid,
        ownerName: profile?.displayName || user.displayName || 'User',
        ownerEmail: profile?.email || user.email || '',
        hosted: true,
        createdAt: Timestamp.now(),
      });
      setNewSiteName('');
      setNewSiteDesc('');
      setNewSiteImage(null);
      setNewSitePlan('free');
      setSiteMsg('Site created and saved to Firebase. It is now visible in Your Websites.');
      setDashView('sites');
    } catch {
      setSiteMsg('Could not create site. Check Firebase rules and login access.');
    }
  };

  const togglePause = async (id: string) => {
    const site = sites.find(s => s.id === id);
    if (!site) return;
    const nextStatus = site.status === 'active' ? 'paused' : 'active';
    try {
      await updateDoc(doc(db, 'sites', id), { status: nextStatus });
      setSites(prev => prev.map(s => s.id === id ? { ...s, status: nextStatus } : s));
    } catch {
      setSites(prev => prev.map(s => s.id === id ? { ...s, status: nextStatus } : s));
    }
  };

  const deleteSite = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'sites', id));
    } catch { /* keep UI responsive */ }
    setSites(prev => prev.filter(s => s.id !== id));
  };

  const updateUserAccess = async (uid: string, role: 'user' | 'admin' | 'manager') => {
    try {
      await updateDoc(doc(db, 'users', uid), { role, status: 'active' });
      const updated = await getAllUsers();
      setAllUsers(updated);
      setAdminMsg(`User access changed to ${role}.`);
    } catch {
      setAdminMsg('Could not update user access. Check Firebase rules.');
    }
  };

  const removeUserRecord = async (uid: string) => {
    try {
      await deleteUserAccount(uid);
      const updated = await getAllUsers();
      setAllUsers(updated);
      setAdminMsg('User removed from dashboard records.');
    } catch {
      setAdminMsg('Could not remove user. Check Firebase rules.');
    }
  };

  const createAccessInvite = async () => {
    if (!user || dashboardRole !== 'manager') {
      setAdminMsg('Only the manager superadmin can create access invites.');
      return;
    }
    if (!inviteEmail.trim() || !inviteName.trim()) {
      setAdminMsg('Add a name and email before generating access.');
      return;
    }
    if (!invitePassword.trim() || invitePassword.length < 6) {
      setAdminMsg('Add a password with at least 6 characters for this account.');
      return;
    }
    if (inviteRole === 'manager' && managerAccessKey !== 'Dniyibizi123@') {
      setAdminMsg('Enter the manager superadmin key before giving manager access.');
      return;
    }

    const words = ['green', 'craft', 'admin', 'site', 'rwanda', 'web', 'nova', 'access'];
    const suffix = Math.floor(100000 + Math.random() * 900000);
    const word = words[Math.floor(Math.random() * words.length)];
    const code = inviteRole === 'admin' ? `kelly-${suffix}${word}` : `kelly-${inviteRole}-${suffix}`;

    try {
      const existing = allUsers.find(u => u.email.toLowerCase() === inviteEmail.trim().toLowerCase());
      if (existing) {
        await updateDoc(doc(db, 'users', existing.uid), { role: inviteRole, status: 'active' });
        setAdminMsg(`${existing.email} is now ${inviteRole}.`);
      } else {
        const secondaryApp = getApps().find(app => app.name === 'webcraft-secondary') || initializeApp(firebaseConfigForSecondary, 'webcraft-secondary');
        const secondaryAuth = getAuth(secondaryApp);
        const newAccount = await createUserWithEmailAndPassword(secondaryAuth, inviteEmail.trim().toLowerCase(), invitePassword.trim());
        await updateSecondaryProfile(newAccount.user, { displayName: inviteName.trim() });
        await setDoc(doc(db, 'users', newAccount.user.uid), {
          uid: newAccount.user.uid,
          displayName: inviteName.trim(),
          email: inviteEmail.trim().toLowerCase(),
          role: inviteRole,
          photoURL: null,
          createdAt: new Date().toISOString(),
          emailVerified: true,
          status: 'active',
        });
        await signOutSecondary(secondaryAuth);
        await addDoc(collection(db, 'pendingUsers'), {
          displayName: inviteName.trim(),
          email: inviteEmail.trim().toLowerCase(),
          role: inviteRole,
          code,
          status: 'created',
          createdBy: user.uid,
          createdAt: Timestamp.now(),
        });
        if (inviteRole === 'admin') {
          await addDoc(collection(db, 'inviteLinks'), {
            code,
            role: 'admin',
            type: 'admin-passkey',
            createdBy: user.uid,
            createdAt: Timestamp.now(),
            used: false,
          });
          const links = await getAllInviteLinks();
          setInviteLinks(links);
        }
        setGeneratedInviteKey(code);
        setAdminMsg(`Access invite generated for ${inviteEmail.trim()}.`);
      }
      setInviteName('');
      setInviteEmail('');
      setInvitePassword('');
      setManagerAccessKey('');
      const updated = await getAllUsers();
      setAllUsers(updated);
    } catch {
      setAdminMsg('Could not create access invite. Check Firebase rules.');
    }
  };

  const generateAdminPasskey = async () => {
    try {
      const code = await generateAdminLink();
      setGeneratedInviteKey(code);
      setGeneratedCode(code);
      const links = await getAllInviteLinks();
      setInviteLinks(links);
      setAdminMsg('Admin passkey generated. Copy it and give it to the admin.');
    } catch {
      setAdminMsg('Only manager superadmin can generate admin passkeys.');
    }
  };

  const resetManagerKey = () => {
    if (!newManagerKey.trim() || newManagerKey.length < 8) {
      setAdminMsg('New manager key must be at least 8 characters.');
      return;
    }
    localStorage.setItem('webcraftManagerKey', newManagerKey.trim());
    setAdminMsg('Manager key reset on this device. Use it for future manager login.');
    setNewManagerKey('');
  };

  const currentLang = langOptions.find(l => l.code === lang)!;
  const navItems = [
    { id: 'home', label: t.home, icon: Home },
    { id: 'projects', label: t.projects, icon: FolderOpen },
    { id: 'buy', label: t.buy, icon: ShoppingCart },
    { id: 'about', label: t.about, icon: Info },
    { id: 'contact', label: t.contact, icon: Mail },
  ];

  const categories = [
    { id: 'ecommerce', label: t.cat1, icon: ShoppingCart, color: 'from-green-400 to-emerald-600' },
    { id: 'portfolio', label: t.cat2, icon: Palette, color: 'from-emerald-400 to-teal-600' },
    { id: 'blog', label: t.cat3, icon: BookOpen, color: 'from-teal-400 to-cyan-600' },
    { id: 'business', label: t.cat4, icon: Monitor, color: 'from-green-500 to-lime-600' },
    { id: 'education', label: t.cat5, icon: Code, color: 'from-emerald-500 to-green-700' },
    { id: 'health', label: t.cat6, icon: Heart, color: 'from-lime-400 to-green-600' },
  ];

  // Load projects from Firestore
  const loadProjects = useCallback(async () => {
    try {
      const q = query(collection(db, 'projects'), orderBy('createdAt', 'desc'));
      const snap = await getDocs(q);
      setProjects(snap.docs.map(d => ({ id: d.id, ...d.data() } as ProjectItem)));
    } catch {
      // If collection doesn't exist yet, that's fine
      setProjects([]);
    }
  }, []);

  useEffect(() => { loadProjects(); }, [loadProjects]);

  useEffect(() => {
    const q = query(collection(db, 'projects'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => setProjects(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as ProjectItem))),
      () => setProjects([]),
    );
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const q = query(collection(db, 'buyWebsites'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        setBuyWebsites(snapshot.docs.map(d => {
          const data = d.data();
          return {
            id: d.id,
            title: data.title || '',
            desc: data.desc || '',
            category: data.category || '',
            price: data.price || '',
            image: data.image || '',
            link: data.link || '',
            createdBy: data.createdBy || '',
            createdAt: data.createdAt?.toDate ? data.createdAt.toDate().toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
          } as BuyWebsiteItem;
        }));
      },
      () => setBuyWebsites([]),
    );
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const q = query(collection(db, 'youtubeAds'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        setYoutubeAds(snapshot.docs.map(d => {
          const data = d.data();
          return {
            id: d.id,
            url: data.url || '',
            videoId: data.videoId || '',
            title: data.title || 'WebCraft YouTube Ad',
            thumbnail: data.thumbnail || '',
            createdBy: data.createdBy || '',
            createdAt: data.createdAt?.toDate ? data.createdAt.toDate().toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
          } as YouTubeAdItem;
        }));
      },
      () => {
        // Keep current ads visible if Firebase rules are not published yet.
      },
    );
    return () => unsubscribe();
  }, []);

  const uploadYouTubeAd = async () => {
    if (!user || !newYouTubeUrl.trim()) return;
    const videoId = getYouTubeVideoId(newYouTubeUrl);
    if (!videoId) {
      setYoutubeMsg('Paste a valid YouTube video URL.');
      return;
    }
    let videoInfo = { title: newYouTubeTitle.trim() || 'WebCraft YouTube Ad', thumbnail: '' };
    try {
      videoInfo = await fetchYouTubeVideo(videoId);
      if (newYouTubeTitle.trim()) videoInfo.title = newYouTubeTitle.trim();
    } catch {
      if (!newYouTubeTitle.trim()) setYoutubeMsg('YouTube API could not verify this video. Add a title or check the URL.');
    }
    const fallbackAd: YouTubeAdItem = {
      id: `yt-local-${Date.now()}`,
      url: newYouTubeUrl.trim(),
      videoId,
      title: videoInfo.title,
      thumbnail: videoInfo.thumbnail,
      createdBy: user.uid,
      createdAt: new Date().toISOString().split('T')[0],
    };
    try {
      await addDoc(collection(db, 'youtubeAds'), {
        url: fallbackAd.url,
        videoId,
        title: fallbackAd.title,
        thumbnail: fallbackAd.thumbnail,
        createdBy: user.uid,
        createdAt: Timestamp.now(),
      });
      setYoutubeAds(prev => prev.some(ad => ad.videoId === videoId) ? prev : [fallbackAd, ...prev]);
      setNewYouTubeUrl('');
      setNewYouTubeTitle('');
      setYoutubeMsg('YouTube ad added to the home page.');
      setTimeout(() => setYoutubeMsg(''), 3500);
    } catch {
      setYoutubeAds(prev => prev.some(ad => ad.videoId === videoId) ? prev : [fallbackAd, ...prev]);
      setNewYouTubeUrl('');
      setNewYouTubeTitle('');
      setYoutubeMsg('YouTube ad is showing now. Publish rulus.html rules to save it online.');
    }
  };

  const removeYouTubeAd = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'youtubeAds', id));
      setYoutubeMsg('YouTube ad removed.');
      setTimeout(() => setYoutubeMsg(''), 2500);
    } catch {
      setYoutubeMsg('Could not remove YouTube ad.');
    }
  };

  const uploadProject = async () => {
    if (!newProjectTitle.trim() || !user) return;
    const fallbackProject: ProjectItem = {
      id: `local-project-${Date.now()}`,
      title: newProjectTitle,
      desc: newProjectDesc,
      tag: newProjectTag || t.cat4,
      image: newProjectImage,
      link: newProjectLink.trim(),
        price: '',
        placement: 'project',
      createdBy: user.uid,
      createdAt: new Date().toISOString().split('T')[0],
    };
    try {
      await addDoc(collection(db, 'projects'), {
        title: fallbackProject.title,
        desc: fallbackProject.desc,
        tag: fallbackProject.tag,
        image: fallbackProject.image,
        link: fallbackProject.link,
        price: '',
        placement: 'project',
        createdBy: user.uid,
        createdAt: Timestamp.now(),
      });
      setProjects(prev => prev.some(item => item.title === fallbackProject.title) ? prev : [fallbackProject, ...prev]);
      setNewProjectTitle('');
      setNewProjectDesc('');
      setNewProjectTag('');
      setNewProjectImage(null);
      setNewProjectLink('');
      setProjectMsg('Project uploaded successfully!');
      loadProjects();
      setTimeout(() => setProjectMsg(''), 3000);
    } catch {
      setProjects(prev => [fallbackProject, ...prev]);
      setProjectMsg('Project added locally. Publish Firebase rules later to save it online.');
    }
  };

  const removeProject = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'projects', id));
      loadProjects();
    } catch { /* ignore */ }
  };

  const uploadSaleWebsite = async () => {
    if (!user || !saleTitle.trim() || !salePrice.trim()) return;
    const fallbackItem: BuyWebsiteItem = {
      id: `sale-local-${Date.now()}`,
      title: saleTitle.trim(),
      desc: saleDesc.trim(),
      category: saleCategory || t.cat4,
      price: salePrice.trim(),
      image: saleImage.trim(),
      link: saleLink.trim(),
      createdBy: user.uid,
      createdAt: new Date().toISOString().split('T')[0],
    };
    const projectFallback: ProjectItem = {
      id: `sale-project-${Date.now()}`,
      title: fallbackItem.title,
      desc: fallbackItem.desc,
      tag: fallbackItem.category,
      image: fallbackItem.image || null,
      link: fallbackItem.link,
      price: fallbackItem.price,
      placement: saleDestination,
      createdBy: user.uid,
      createdAt: fallbackItem.createdAt,
    };

    const saveSaleAsProject = async () => {
      await addDoc(collection(db, 'projects'), {
        title: fallbackItem.title,
        desc: fallbackItem.desc,
        tag: fallbackItem.category,
        image: fallbackItem.image || null,
        link: fallbackItem.link,
        price: fallbackItem.price,
        placement: saleDestination,
        createdBy: user.uid,
        createdAt: Timestamp.now(),
      });
      setProjects(prev => prev.some(item => item.title.toLowerCase() === fallbackItem.title.toLowerCase())
        ? prev
        : [projectFallback, ...prev]
      );
    };

    const wantsSale = saleDestination === 'sale' || saleDestination === 'both';
    const wantsProject = saleDestination === 'project' || saleDestination === 'both';
    const savedTo: string[] = [];

    try {
      await saveSaleAsProject();
      if (wantsSale) savedTo.push('Websites For Sale');
      if (wantsProject) savedTo.push('Our Projects');
    } catch {
      setSaleMsg('Firebase did not save this upload. Publish rulus.html rules in Firebase, then upload again.');
      setTimeout(() => setSaleMsg(''), 5000);
      return;
    }

    setSaleMsg(`Website uploaded to ${savedTo.join(' and ')}.`);
    setTimeout(() => setSaleMsg(''), 3500);
    setSaleTitle('');
    setSaleDesc('');
    setSaleCategory('');
    setSalePrice('');
    setSaleImage('');
    setSaleLink('');
    setSaleDestination('sale');
  };

  const removeSaleWebsite = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'projects', id));
      setSaleMsg('Website listing removed.');
      setTimeout(() => setSaleMsg(''), 2500);
    } catch {
      try {
        await deleteDoc(doc(db, 'buyWebsites', id));
        setSaleMsg('Website listing removed.');
      } catch {
        setSaleMsg('Could not remove listing.');
      }
    }
  };

  const loadContacts = useCallback(async () => {
    try {
      const q = query(collection(db, 'contacts'), orderBy('createdAt', 'desc'));
      const snap = await getDocs(q);
      setContacts(snap.docs.map(d => {
        const data = d.data();
        return {
          id: d.id,
          name: data.name || '',
          email: data.email || '',
          message: data.message || '',
          reply: data.reply || '',
          status: data.status || 'new',
          createdAt: data.createdAt?.toDate ? data.createdAt.toDate().toLocaleString() : new Date().toLocaleString(),
        } as ContactMessage;
      }));
    } catch {
      setContacts([]);
    }
  }, []);

  useEffect(() => { loadContacts(); }, [loadContacts]);

  useEffect(() => {
    if (dashboardRole !== 'admin' && dashboardRole !== 'manager') return;

    const q = query(collection(db, 'contacts'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        setContacts(snapshot.docs.map(d => {
          const data = d.data();
          return {
            id: d.id,
            name: data.name || '',
            email: data.email || '',
            message: data.message || '',
            reply: data.reply || '',
            status: data.status || 'new',
            createdAt: data.createdAt?.toDate ? data.createdAt.toDate().toLocaleString() : new Date().toLocaleString(),
          } as ContactMessage;
        }));
      },
      () => setContacts([]),
    );
    return () => unsubscribe();
  }, [dashboardRole]);

  useEffect(() => {
    if (dashboardRole === 'admin' || dashboardRole === 'manager') {
      getAllUsers().then(setAllUsers).catch(() => setAllUsers([]));
      loadContacts();
    }
  }, [dashboardRole, loadContacts]);

  useEffect(() => {
    if (dashboardRole !== 'admin' && dashboardRole !== 'manager') return;

    const unsubscribe = onSnapshot(
      collection(db, 'users'),
      (snapshot) => setAllUsers(snapshot.docs.map(d => d.data() as import('./AuthContext').UserProfile)),
      () => setAllUsers([]),
    );
    return () => unsubscribe();
  }, [dashboardRole]);

  useEffect(() => {
    const unsubscribe = onSnapshot(
      doc(db, 'settings', 'contactInfo'),
      (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.data();
          setContactInfo({
            email: data.email || 'kellyseekhelp@gmail.com',
            phone: data.phone || '0733536250',
            location: data.location || 'Kigali, Rwanda',
          });
        }
      },
      () => undefined,
    );
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const unsubscribe = onSnapshot(
      doc(db, 'settings', 'downloadLinks'),
      (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.data();
          setDownloadLinks({
            apk: data.apk || '',
            windows: data.windows || '',
          });
        }
      },
      () => undefined,
    );
    return () => unsubscribe();
  }, []);

  const saveContactInfo = async () => {
    if (dashboardRole !== 'manager') return;
    try {
      await setDoc(doc(db, 'settings', 'contactInfo'), contactInfo, { merge: true });
      setContactInfoMsg('Contact information updated.');
      setTimeout(() => setContactInfoMsg(''), 3000);
    } catch {
      setContactInfoMsg('Could not save contact info. Publish rulus.html rules.');
    }
  };

  const saveDownloadLinks = async () => {
    if (dashboardRole !== 'manager') return;
    try {
      await setDoc(doc(db, 'settings', 'downloadLinks'), downloadLinks, { merge: true });
      setDownloadLinksMsg('Download links updated.');
      setTimeout(() => setDownloadLinksMsg(''), 3000);
    } catch {
      setDownloadLinksMsg('Could not save download links. Publish rulus.html rules.');
    }
  };

  const submitContact = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!contactName.trim() || !contactEmail.trim() || !contactMessage.trim()) return;
    try {
      await addDoc(collection(db, 'contacts'), {
        name: contactName.trim(),
        email: contactEmail.trim(),
        message: contactMessage.trim(),
        status: 'new',
        createdAt: Timestamp.now(),
      });
      setContactName('');
      setContactEmail('');
      setContactMessage('');
      setAdminMsg('Message sent successfully. Manager will reply soon.');
      loadContacts();
      setTimeout(() => setAdminMsg(''), 3500);
    } catch {
      setAdminMsg('Could not send message. Try again.');
    }
  };

  const replyContact = async (contactId: string) => {
    const reply = replyDrafts[contactId]?.trim();
    if (!reply) return;
    try {
      await updateDoc(doc(db, 'contacts', contactId), {
        reply,
        status: 'replied',
        repliedBy: user?.uid,
        repliedAt: Timestamp.now(),
      });
      setReplyDrafts(prev => ({ ...prev, [contactId]: '' }));
      loadContacts();
    } catch {
      setAdminMsg('Reply failed.');
    }
  };

  const sendNotification = async () => {
    if (!notifyText.trim() || !user) return;
    const message = notifyText.trim();
    try {
      await addDoc(collection(db, 'notifications'), {
        message,
        sentBy: user.uid,
        createdAt: Timestamp.now(),
      });
      setNotifyText('');
      setAdminMsg('Notification sent to users.');
      setTimeout(() => setAdminMsg(''), 3000);
    } catch {
      // Keep the manager flow smooth even if Firebase rules/network are not ready yet.
      setNotifyText('');
      setAdminMsg(`Notification ready: "${message}"`);
      setTimeout(() => setAdminMsg(''), 3000);
    }
  };

  const activeSites = sites.filter(s => s.status === 'active').length;
  const pausedSites = sites.filter(s => s.status === 'paused').length;
  const storageUsedLabel = `${Math.max(1, Math.ceil(JSON.stringify({ sites, projects, contacts }).length / 1024))} KB`;
  const dashboardUsers = allUsers.length > 0 ? allUsers : (profile ? [profile] : []);
  const totalUsersCount = dashboardUsers.length;
  const activeUsersCount = dashboardUsers.filter(u => u.status === 'active').length;
  const realVisitors = dashboardRole === 'manager' || dashboardRole === 'admin' ? totalUsersCount : 0;
  const uniqueOwners = new Set(sites.map(site => site.ownerId).filter(Boolean)).size;
  const newMessages = contacts.filter(contact => contact.status === 'new').length;
  const pendingUsers = dashboardUsers.filter(u => u.status === 'pending').length;
  const siteDescriptionWords = newSiteDesc.trim().split(/\s+/).filter(Boolean).length;
  const siteDescriptionReady = siteDescriptionWords >= 2;
  const signupCreatedAt = profile?.createdAt ? new Date(profile.createdAt).getTime() : Date.now();
  const signupWaitEndsAt = signupCreatedAt + 3 * 60 * 60 * 1000;
  const signupWaitMs = Math.max(0, signupWaitEndsAt - Date.now());
  const signupWaitHours = Math.floor(signupWaitMs / (60 * 60 * 1000));
  const signupWaitMinutes = Math.floor((signupWaitMs % (60 * 60 * 1000)) / (60 * 1000));
  const visibleProjects = projects.filter(project => {
    const term = projectSearch.trim().toLowerCase();
    if (project.placement === 'sale') return false;
    if (!term) return true;
    return [project.title, project.desc, project.tag].some(value => value?.toLowerCase().includes(term));
  });
  const projectSaleItems: BuyWebsiteItem[] = projects
    .filter(project => project.placement === 'sale' || project.placement === 'both')
    .map(project => ({
      id: project.id,
      title: project.title,
      desc: project.desc,
      category: project.tag,
      price: project.price || 'Contact',
      image: project.image || '',
      link: project.link || '',
      createdBy: project.createdBy,
      createdAt: project.createdAt,
    }));
  const publicBuyWebsites = [
    ...projectSaleItems,
    ...buyWebsites.filter(item => !projectSaleItems.some(projectItem => projectItem.title === item.title)),
  ];
  const displayedProjects = showAllProjects ? visibleProjects : visibleProjects.slice(0, 6);
  const displayedBuyWebsites = showAllBuyWebsites ? publicBuyWebsites : publicBuyWebsites.slice(0, 6);

  // ===================== FULL PAGE DASHBOARD =====================
  if (showDashboard) {
    if (!user) {
      return <LoginPage onBack={() => { setShowLogin(false); setShowDashboard(false); }} />;
    }

    if (profile?.status === 'pending' && dashboardRole === 'user') {
      return (
        <div className="min-h-screen bg-[#0a0a0a] text-white bg-mesh flex items-center justify-center p-4">
          <div className="max-w-lg w-full glass-strong rounded-3xl p-8 text-center">
            <div className="w-16 h-16 rounded-2xl bg-yellow-500/15 flex items-center justify-center mx-auto mb-5">
              <Clock size={30} className="text-yellow-400" />
            </div>
            <h1 className="text-2xl font-bold mb-3">Account Waiting For Confirmation</h1>
            <p className="text-gray-400 mb-6">Your signup was received. A manager or admin must confirm your account within 3 hours before you can use the dashboard.</p>
            <div className="mb-6 rounded-2xl border border-yellow-500/20 bg-yellow-500/10 p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-yellow-400">Time remaining</p>
              <p className="mt-2 text-3xl font-bold text-yellow-200">{signupWaitHours}h {signupWaitMinutes}m</p>
              <p className="mt-2 text-xs text-yellow-100/70">Admin and manager are creating your profile website using your data. Available domains: .netlify.app, .edgeone.app, and vercel.app.</p>
            </div>
            <div className="rounded-2xl bg-white/[0.04] p-4 mb-6 text-left">
              <p className="text-xs text-gray-500">Signed in as</p>
              <p className="font-semibold">{profile?.email || user.email}</p>
              <p className="mt-2 text-xs text-yellow-400">Status: pending approval</p>
            </div>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <button onClick={() => setShowDashboard(false)} className="btn-primary px-5 py-3 rounded-xl text-sm font-semibold text-white">View Public Website</button>
              <button onClick={logout} className="px-5 py-3 rounded-xl glass text-sm font-semibold text-gray-300 hover:bg-white/10">Sign Out</button>
            </div>
          </div>
        </div>
      );
    }

    const dashNavItems: { id: DashView; label: string; icon: typeof Home }[] = dashboardRole === 'manager'
      ? [
          { id: 'overview', label: 'Manager Home', icon: Crown },
          { id: 'users', label: 'All Users', icon: Users },
          { id: 'contacts', label: 'Messages', icon: MessageSquare },
          { id: 'sites', label: 'User Websites', icon: Layers },
          { id: 'uploadProjects', label: 'Projects', icon: FolderOpen },
          { id: 'sellWebsites', label: 'Sell Websites', icon: ShoppingCart },
          { id: 'youtubeAds', label: 'YouTube Ads', icon: Monitor },
          { id: 'analytics', label: 'Real Analytics', icon: BarChart3 },
          { id: 'settings', label: t.settings, icon: Settings },
        ]
      : dashboardRole === 'admin'
        ? [
            { id: 'overview', label: 'Admin Home', icon: Shield },
            { id: 'users', label: 'Users', icon: Users },
            { id: 'contacts', label: 'Messages', icon: MessageSquare },
            { id: 'sites', label: 'User Websites', icon: Layers },
            { id: 'uploadProjects', label: 'Projects', icon: FolderOpen },
            { id: 'sellWebsites', label: 'Sell Websites', icon: ShoppingCart },
            { id: 'youtubeAds', label: 'YouTube Ads', icon: Monitor },
            { id: 'analytics', label: 'Analytics', icon: BarChart3 },
            { id: 'settings', label: t.settings, icon: Settings },
          ]
        : [
            { id: 'overview', label: t.overview, icon: LayoutDashboard },
            { id: 'create', label: t.createSite, icon: Plus },
            { id: 'sites', label: t.manageSites, icon: Layers },
            { id: 'plans', label: t.plans, icon: Crown },
            { id: 'settings', label: t.settings, icon: Settings },
          ];

    return (
      <div className="min-h-screen bg-[#0a0a0a] text-white bg-mesh">
        {/* Dashboard Top Bar */}
        <div className="fixed top-0 left-0 right-0 z-50 glass h-14 flex items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-green-500 to-green-600 flex items-center justify-center green-glow">
              <span className="text-white font-bold text-sm">W</span>
            </div>
            <span className="font-bold text-lg hidden sm:block">{t.brand}</span>
            <span className="text-gray-500 hidden sm:block">/</span>
            <span className="text-green-400 font-medium hidden sm:block">{t.dashTitle}</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative" ref={langRef}>
              <button onClick={() => setLangOpen(!langOpen)} className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm text-gray-300 hover:text-green-400 hover:bg-white/5 transition-all">
                <Globe size={14} /><span className="hidden sm:inline">{currentLang.flag} {currentLang.label}</span>
                <ChevronDown size={12} className={`transition-transform ${langOpen ? 'rotate-180' : ''}`} />
              </button>
              {langOpen && (
                <div className="absolute right-0 top-full mt-2 glass-strong rounded-xl p-2 min-w-[180px] z-50">
                  {langOptions.map(l => (
                    <button key={l.code} onClick={() => { setLang(l.code); setLangOpen(false); }} className={`w-full text-left px-3 py-2 rounded-lg text-sm flex items-center gap-3 transition-all ${lang === l.code ? 'bg-green-500/20 text-green-400' : 'text-gray-300 hover:bg-white/5'}`}>
                      <span>{l.flag}</span><span>{l.label}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <button onClick={() => { setShowDashboard(false); }} className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm text-gray-300 hover:text-green-400 hover:bg-white/5 transition-all">
              <ArrowLeft size={14} /><span className="hidden sm:inline">{t.backToDash}</span>
            </button>
          </div>
        </div>

        <div className="flex pt-14 min-h-screen">
          {/* Dashboard Sidebar */}
          <div className="hidden md:flex flex-col w-60 glass-strong border-r border-white/5 fixed top-14 bottom-0 overflow-y-auto">
            <div className="p-4">
              <div className="flex items-center gap-3 mb-6 px-2">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center">
                  <span className="text-white font-bold">{(profile?.displayName || user?.displayName || 'U')[0].toUpperCase()}</span>
                </div>
                <div>
                  <p className="font-semibold text-sm truncate max-w-[120px]">{profile?.displayName || user?.displayName || 'User'}</p>
                  <p className="text-xs text-gray-400">{dashboardRole} {dashboardRole === 'manager' ? '\u{1F451}' : dashboardRole === 'admin' ? '\u{1F6E1}\u{FE0F}' : ''}</p>
                </div>
              </div>
              <nav className="space-y-1">
                {dashNavItems.map(item => (
                  <button key={item.id} onClick={() => setDashView(item.id)} className={`dash-sidebar-link w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all ${dashView === item.id ? 'bg-green-500/15 text-green-400 font-medium' : 'text-gray-400 hover:text-gray-200'}`}>
                    <item.icon size={18} />{item.label}
                  </button>
                ))}
              </nav>
            </div>
          </div>

          {/* Mobile bottom nav for dashboard */}
          <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 glass-strong px-1 py-1.5 flex items-center justify-around">
            {dashNavItems.slice(0, 5).map(item => (
              <button key={item.id} onClick={() => setDashView(item.id)} className={`flex flex-col items-center gap-0.5 p-1.5 rounded-lg transition-all ${dashView === item.id ? 'text-green-400' : 'text-gray-400'}`}>
                <item.icon size={16} /><span className="text-[8px]">{item.label}</span>
              </button>
            ))}
          </div>

          {/* Dashboard Content */}
          <div className="flex-1 md:ml-60 p-4 sm:p-6 lg:p-8 pb-20 md:pb-8">

            {/* ===== OVERVIEW ===== */}
            {dashView === 'overview' && (
              <div className="max-w-6xl mx-auto">
                <div className="mb-8">
                  <p className="text-gray-400 text-sm">{t.dashWelcome},</p>
                  <h1 className="text-3xl font-bold text-gradient">{profile?.displayName || user?.displayName || 'User'}</h1>
                </div>
                {dashboardRole === 'manager' && profile?.role !== 'manager' && (
                  <div className="mb-6 rounded-2xl border border-yellow-500/20 bg-yellow-500/10 p-4 text-sm text-yellow-200">
                    Manager UI is open, but Firebase still has this account as <span className="font-bold">{profile?.role || 'unknown'}</span>. Publish the newest rules and make sure /users/{user?.uid} has role: "manager" and status: "active" to enable all manager functions.
                  </div>
                )}
                <div className={`mb-8 rounded-3xl border p-6 ${dashboardRole === 'manager' ? 'border-yellow-500/20 bg-yellow-500/5' : dashboardRole === 'admin' ? 'border-green-500/20 bg-green-500/5' : 'border-white/5 bg-white/[0.03]'}`}>
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className={`mb-1 text-xs font-semibold uppercase tracking-[0.25em] ${dashboardRole === 'manager' ? 'text-yellow-400' : dashboardRole === 'admin' ? 'text-green-400' : 'text-gray-400'}`}>
                        {dashboardRole === 'manager' ? 'Superadmin Manager Dashboard' : dashboardRole === 'admin' ? 'Admin Dashboard' : 'User Dashboard'}
                      </p>
                      <h2 className="text-2xl font-bold">
                        {dashboardRole === 'manager' ? 'Control users, admins, projects, messages, and access keys.' : dashboardRole === 'admin' ? 'Manage records, projects, users, and incoming messages.' : 'Create sites, manage your websites, and choose your plan.'}
                      </h2>
                    </div>
                    <div className="flex gap-2">
                      {dashboardRole === 'manager' && <button onClick={() => setDashView('users')} className="rounded-xl bg-yellow-500/20 px-4 py-2 text-sm font-semibold text-yellow-300">Manage Access</button>}
                      {dashboardRole === 'admin' && <button onClick={() => setDashView('contacts')} className="rounded-xl bg-green-500/20 px-4 py-2 text-sm font-semibold text-green-300">View Messages</button>}
                      {dashboardRole === 'user' && <button onClick={() => setDashView('create')} className="btn-primary rounded-xl px-4 py-2 text-sm font-semibold text-white">Create Site</button>}
                    </div>
                  </div>
                </div>
                {(dashboardRole === 'admin' || dashboardRole === 'manager') && (
                  <div className="grid grid-cols-1 gap-4 mb-8 sm:grid-cols-4">
                    <button onClick={() => setDashView('users')} className="rounded-xl border border-white/5 bg-white/[0.03] p-5 text-left transition-all hover:border-green-500/30 hover:bg-white/[0.06]">
                      <Users size={22} className="mb-3 text-green-400" />
                      <p className="text-2xl font-bold">{totalUsersCount}</p>
                      <p className="text-xs text-gray-400">Total Users</p>
                    </button>
                    <button onClick={() => setDashView('users')} className="rounded-xl border border-white/5 bg-white/[0.03] p-5 text-left transition-all hover:border-green-500/30 hover:bg-white/[0.06]">
                      <UserCheck size={22} className="mb-3 text-emerald-400" />
                      <p className="text-2xl font-bold">{activeUsersCount}</p>
                      <p className="text-xs text-gray-400">Active Users</p>
                    </button>
                    <button onClick={() => setDashView('contacts')} className="rounded-xl border border-white/5 bg-white/[0.03] p-5 text-left transition-all hover:border-green-500/30 hover:bg-white/[0.06]">
                      <MessageSquare size={22} className="mb-3 text-teal-400" />
                      <p className="text-2xl font-bold">{contacts.length}</p>
                      <p className="text-xs text-gray-400">Get In Touch Messages</p>
                    </button>
                    <button onClick={() => setDashView('users')} className="rounded-xl border border-yellow-500/10 bg-yellow-500/[0.04] p-5 text-left transition-all hover:border-yellow-500/30 hover:bg-yellow-500/[0.07]">
                      <Clock size={22} className="mb-3 text-yellow-400" />
                      <p className="text-2xl font-bold">{pendingUsers}</p>
                      <p className="text-xs text-gray-400">Pending Confirmations</p>
                    </button>
                  </div>
                )}
                {/* Stats */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                  {[
                    { label: dashboardRole === 'user' ? t.dashSites : 'All User Websites', value: sites.length.toString(), icon: Monitor, color: 'text-green-400', bg: 'from-green-500/10 to-green-500/5' },
                    { label: t.dashStorage, value: storageUsedLabel, icon: HardDrive, color: 'text-emerald-400', bg: 'from-emerald-500/10 to-emerald-500/5' },
                    { label: dashboardRole === 'user' ? t.dashVisitors : 'Known Users', value: realVisitors.toString(), icon: Users, color: 'text-teal-400', bg: 'from-teal-500/10 to-teal-500/5' },
                    { label: t.dashPlan, value: t[selectedPlan] || t.free, icon: Star, color: 'text-lime-400', bg: 'from-lime-500/10 to-lime-500/5' },
                  ].map((stat, i) => (
                    <div key={i} className={`rounded-xl p-5 bg-gradient-to-br ${stat.bg} border border-white/5 hover:border-green-500/20 transition-all`}>
                      <stat.icon size={22} className={stat.color + ' mb-3'} />
                      <p className="text-2xl font-bold">{stat.value}</p>
                      <p className="text-gray-400 text-xs mt-1">{stat.label}</p>
                    </div>
                  ))}
                </div>
                {/* Quick Actions */}
                <h3 className="text-lg font-semibold mb-4">{t.dashQuick}</h3>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
                  {(dashboardRole === 'manager'
                    ? [
                        { label: 'All Users', icon: Users, view: 'users' as DashView },
                        { label: 'Messages', icon: MessageSquare, view: 'contacts' as DashView },
                        { label: 'User Websites', icon: Layers, view: 'sites' as DashView },
                        { label: 'Upload Projects', icon: FolderOpen, view: 'uploadProjects' as DashView },
                        { label: 'YouTube Ads', icon: Monitor, view: 'youtubeAds' as DashView },
                      ]
                    : dashboardRole === 'admin'
                      ? [
                          { label: 'Users', icon: Users, view: 'users' as DashView },
                          { label: 'Messages', icon: MessageSquare, view: 'contacts' as DashView },
                          { label: 'User Websites', icon: Layers, view: 'sites' as DashView },
                          { label: 'Projects', icon: FolderOpen, view: 'uploadProjects' as DashView },
                          { label: 'YouTube Ads', icon: Monitor, view: 'youtubeAds' as DashView },
                        ]
                      : [
                          { label: t.createNew, icon: Plus, view: 'create' as DashView },
                          { label: t.manageSites, icon: Layers, view: 'sites' as DashView },
                          { label: t.viewAnalytics, icon: BarChart3, view: 'analytics' as DashView },
                          { label: t.plans, icon: Crown, view: 'plans' as DashView },
                        ]
                  ).map((action, i) => (
                    <button key={i} onClick={() => setDashView(action.view)} className="glass-card rounded-xl p-5 flex flex-col items-center gap-3 text-center">
                      <div className="w-10 h-10 rounded-xl bg-green-500/10 flex items-center justify-center">
                        <action.icon size={20} className="text-green-400" />
                      </div>
                      <span className="text-sm text-gray-300">{action.label}</span>
                    </button>
                  ))}
                </div>
                {/* Recent Activity */}
                <h3 className="text-lg font-semibold mb-4">{t.dashActivity}</h3>
                {sites.length === 0 ? (
                  <div className="rounded-xl border border-white/5 bg-white/[0.03] p-8 text-center">
                    <Clock size={28} className="mx-auto mb-3 text-gray-600" />
                    <p className="text-sm text-gray-400">{dashboardRole === 'user' ? 'Dashboard is clear. Create your first site to start activity.' : 'No user websites yet. When users create websites, they appear here in real time.'}</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {sites.map((site) => (
                      <div key={site.id} className="flex items-center gap-4 p-3 rounded-xl hover:bg-white/5 transition-all">
                        <div className="w-8 h-8 rounded-lg bg-green-500/10 flex items-center justify-center"><Globe size={14} className="text-green-400" /></div>
                        <div className="flex-1"><p className="text-sm text-gray-200">Website "{site.name}" created</p>{(dashboardRole === 'manager' || dashboardRole === 'admin') && <p className="text-xs text-gray-500">By {site.ownerName || 'User'} {site.ownerEmail ? `(${site.ownerEmail})` : ''}</p>}</div>
                        <span className="text-xs text-gray-500 flex items-center gap-1"><Clock size={12} />{site.createdAt}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ===== CREATE NEW SITE ===== */}
            {dashView === 'create' && (
              <div className="max-w-3xl mx-auto">
                <h1 className="text-2xl font-bold mb-2">{t.createSite}</h1>
                <p className="text-gray-400 mb-8">{t.selectPlan} & {t.startBuild}</p>
                {siteMsg && (
                  <div className={`mb-5 rounded-xl border p-3 text-sm ${siteMsg.includes('Could not') ? 'border-red-500/20 bg-red-500/10 text-red-300' : 'border-green-500/20 bg-green-500/10 text-green-300'}`}>
                    {siteMsg}
                  </div>
                )}

                {/* Plan Selection */}
                <div className="grid grid-cols-3 gap-3 mb-8">
                  {(['free', 'premium', 'vip'] as PlanType[]).map(plan => {
                    const cfg = planConfig[plan];
                    const isSelected = newSitePlan === plan;
                    return (
                      <button key={plan} onClick={() => setNewSitePlan(plan)} className={`rounded-xl p-4 text-center transition-all border ${isSelected ? 'border-green-500/50 bg-green-500/10 ring-1 ring-green-500/30' : 'border-white/5 bg-white/3 hover:bg-white/5'}`}>
                        <cfg.icon size={20} className={`${cfg.color} mx-auto mb-2`} />
                        <p className="font-bold text-sm">{t[plan]}</p>
                        <p className="text-xs text-gray-400 mt-1">{plan === 'free' ? t.freeP : plan === 'premium' ? t.premP : t.vipP}</p>
                        <div className={`domain-badge mt-2 mx-auto justify-center ${cfg.bgColor} ${cfg.color}`}>
                          <Link2 size={10} />{cfg.domain}
                        </div>
                        <div className={`domain-badge mt-1.5 mx-auto justify-center text-[10px] ${cfg.hasWatermark ? 'bg-amber-500/15 text-amber-400' : 'bg-green-500/15 text-green-400'}`}>
                          {cfg.hasWatermark ? (
                            <><svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>kellyseekhelp</>
                          ) : (
                            <><Check size={9} />{t.noWatermark}</>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>

                {/* Site Form */}
                <div className="space-y-6">
                  {/* Site Name */}
                  <div>
                    <label className="text-sm text-gray-400 mb-2 flex items-center gap-2"><Type size={14} />{t.siteName}</label>
                    <input type="text" value={newSiteName} onChange={e => setNewSiteName(e.target.value)} placeholder={t.siteNamePh} className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-500 focus:border-green-500/50 focus:outline-none focus:ring-1 focus:ring-green-500/30 transition-all" />
                  </div>

                  {/* Site Description */}
                  <div>
                    <label className="text-sm text-gray-400 mb-2 flex items-center gap-2"><FileText size={14} />{t.siteDesc}</label>
                    <textarea value={newSiteDesc} onChange={e => setNewSiteDesc(e.target.value)} placeholder={t.siteDescPh} rows={4} className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-500 focus:border-green-500/50 focus:outline-none focus:ring-1 focus:ring-green-500/30 transition-all resize-none" />
                    <div className={`mt-2 rounded-xl border px-3 py-2 text-xs ${siteDescriptionReady ? 'border-green-500/20 bg-green-500/10 text-green-300' : 'border-yellow-500/20 bg-yellow-500/10 text-yellow-300'}`}>
                      {siteDescriptionReady ? 'Good description. You can publish this site.' : `Please write at least 2 words about the website. Current: ${siteDescriptionWords}/2 words.`}
                    </div>
                  </div>

                  {/* Image Upload */}
                  <div>
                    <label className="text-sm text-gray-400 mb-2 flex items-center gap-2"><Image size={14} />{t.siteImage}</label>
                    <div
                      className={`upload-zone rounded-xl p-8 text-center cursor-pointer ${isDragging ? 'dragging' : ''}`}
                      onClick={() => fileInputRef.current?.click()}
                      onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
                      onDragLeave={() => setIsDragging(false)}
                      onDrop={handleDrop}
                    >
                      {newSiteImage ? (
                        <div className="relative inline-block">
                          <img src={newSiteImage} alt="Preview" className="max-h-48 rounded-lg mx-auto" />
                          <button onClick={e => { e.stopPropagation(); setNewSiteImage(null); }} className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-red-500 flex items-center justify-center hover:bg-red-600 transition-all">
                            <X size={12} />
                          </button>
                          <p className="text-xs text-green-400 mt-3 flex items-center justify-center gap-1"><CheckCircle2 size={12} />{t.imagePreview}</p>
                        </div>
                      ) : (
                        <div>
                          <Upload size={32} className="text-gray-500 mx-auto mb-3" />
                          <p className="text-gray-400 text-sm">{t.dragDrop}</p>
                          <p className="text-gray-500 text-xs mt-2">PNG, JPG, GIF up to 10MB</p>
                        </div>
                      )}
                      <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleImageUpload(f); }} />
                    </div>
                  </div>

                  {/* Preview Card */}
                  {newSiteName && (
                    <div className="glass-card rounded-xl p-5">
                      <h4 className="text-sm text-gray-400 mb-3 flex items-center gap-2"><Eye size={14} />Preview</h4>
                      <div className="flex items-start gap-4">
                        {newSiteImage ? (
                          <img src={newSiteImage} alt="" className="w-20 h-20 rounded-lg object-cover flex-shrink-0" />
                        ) : (
                          <div className="w-20 h-20 rounded-lg bg-gradient-to-br from-green-500/20 to-emerald-500/10 flex items-center justify-center flex-shrink-0">
                            <Globe size={24} className="text-green-400/50" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <h3 className="font-bold truncate">{newSiteName}</h3>
                          <p className="text-sm text-gray-400 truncate">{newSiteDesc || 'No description'}</p>
                          <div className="flex flex-wrap gap-1.5 mt-2">
                            <div className={`domain-badge ${planConfig[newSitePlan].bgColor} ${planConfig[newSitePlan].color}`}>
                              <Link2 size={10} />{newSiteName.toLowerCase().replace(/\s+/g, '')}{planConfig[newSitePlan].domain.split('/')[0].trim()}
                            </div>
                            <div className={`domain-badge ${planConfig[newSitePlan].hasWatermark ? 'bg-amber-500/15 text-amber-400' : 'bg-green-500/15 text-green-400'}`}>
                              {planConfig[newSitePlan].hasWatermark ? (
                                <><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>kellyseekhelp</>
                              ) : (
                                <><Check size={10} />{t.noWatermark}</>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Publish */}
                  <button onClick={publishSite} disabled={!newSiteName.trim()} className="btn-primary w-full py-3.5 rounded-xl text-white font-semibold flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:transform-none disabled:hover:shadow-none">
                    <Zap size={16} />{t.publishSite}
                  </button>
                </div>
              </div>
            )}

            {/* ===== MY SITES ===== */}
            {dashView === 'sites' && (
              <div className="max-w-6xl mx-auto">
                <div className="flex items-center justify-between mb-8">
                  <div>
                    <h1 className="text-2xl font-bold">{dashboardRole === 'user' ? t.yourSites : 'User Created Websites'}</h1>
                    <p className="mt-1 text-xs text-green-400">Live synced from Firebase Firestore{dashboardRole !== 'user' ? ' - all user website requests' : ''}</p>
                  </div>
                  {dashboardRole === 'user' && (
                    <button onClick={() => setDashView('create')} className="btn-primary px-4 py-2 rounded-xl text-white text-sm font-semibold flex items-center gap-2">
                      <Plus size={16} />{t.createNew}
                    </button>
                  )}
                </div>
                {siteMsg && (
                  <div className={`mb-5 rounded-xl border p-3 text-sm ${siteMsg.includes('Could not') ? 'border-red-500/20 bg-red-500/10 text-red-300' : 'border-green-500/20 bg-green-500/10 text-green-300'}`}>
                    {siteMsg}
                  </div>
                )}
                {sites.length === 0 ? (
                  <div className="text-center py-20">
                    <Globe size={48} className="text-gray-600 mx-auto mb-4" />
                    <p className="text-gray-400">{dashboardRole === 'user' ? t.noSites : 'No user website requests yet.'}</p>
                    {dashboardRole === 'user' && (
                      <button onClick={() => setDashView('create')} className="btn-primary px-6 py-2.5 rounded-xl text-white text-sm font-semibold mt-4 inline-flex items-center gap-2">
                        <Plus size={16} />{t.createSite}
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {sites.map(site => {
                      const cfg = planConfig[site.plan];
                      return (
                        <div key={site.id} className="glass-card rounded-xl overflow-hidden">
                          <div className="h-36 bg-gradient-to-br from-green-500/15 to-emerald-500/5 flex items-center justify-center relative overflow-hidden">
                            {site.image ? (
                              <img src={site.image} alt={site.name} className="w-full h-full object-cover" />
                            ) : (
                              <Globe size={36} className="text-green-400/30" />
                            )}
                            <div className="absolute top-2 right-2 flex gap-1">
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${site.status === 'active' ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'}`}>
                                {t[site.status]}
                              </span>
                            </div>
                          </div>
                          <div className="p-4">
                            <div className="flex items-center gap-2 mb-1">
                              <cfg.icon size={14} className={cfg.color} />
                              <h3 className="font-bold text-sm truncate">{site.name}</h3>
                            </div>
                            <p className="text-xs text-gray-400 truncate mb-2">{site.description}</p>
                            {dashboardRole !== 'user' && <p className="text-[10px] text-green-400 mb-2 truncate">Owner: {site.ownerName || 'User'} {site.ownerEmail ? `(${site.ownerEmail})` : ''}</p>}
                            <div className={`domain-badge ${cfg.bgColor} ${cfg.color} text-[10px] mb-2`}>
                              <Link2 size={9} />{site.name.toLowerCase().replace(/\s+/g, '')}{cfg.domain.split('/')[0].trim()}
                            </div>
                            <div className={`domain-badge mb-3 text-[10px] ${cfg.hasWatermark ? 'bg-amber-500/15 text-amber-400' : 'bg-green-500/15 text-green-400'}`}>
                              {cfg.hasWatermark ? (
                                <><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>kellyseekhelp</>
                              ) : (
                                <><Check size={10} />{t.noWatermark}</>
                              )}
                            </div>
                            <div className="flex items-center gap-1.5">
                              <button onClick={() => togglePause(site.id)} className="flex-1 px-2 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-xs text-gray-300 transition-all flex items-center justify-center gap-1">
                                {site.status === 'active' ? <><Clock size={11} />{t.pause}</> : <><Zap size={11} />{t.resume}</>}
                              </button>
                              <button className="px-2 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-xs text-gray-300 transition-all"><Edit3 size={11} /></button>
                              <button className="px-2 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-xs text-gray-300 transition-all"><ExternalLink size={11} /></button>
                              <button onClick={() => deleteSite(site.id)} className="px-2 py-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-xs text-red-400 transition-all"><Trash2 size={11} /></button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* ===== ANALYTICS ===== */}
            {dashView === 'analytics' && (
              <div className="max-w-6xl mx-auto">
                <h1 className="text-2xl font-bold mb-8">{t.analytics}</h1>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                  {[
                    { label: 'Total Sites', value: sites.length.toString(), change: `${activeSites} active`, icon: Eye },
                    { label: 'Unique Owners', value: uniqueOwners.toString(), change: `${totalUsersCount} users`, icon: Users },
                    { label: 'Messages', value: contacts.length.toString(), change: `${newMessages} new`, icon: TrendingUp },
                    { label: 'Paused Sites', value: pausedSites.toString(), change: `${projects.length} projects`, icon: Clock },
                  ].map((stat, i) => (
                    <div key={i} className="glass-card rounded-xl p-5">
                      <stat.icon size={20} className="text-green-400 mb-3" />
                      <p className="text-2xl font-bold">{stat.value}</p>
                      <p className="text-gray-400 text-xs mt-1">{stat.label}</p>
                      <span className="text-xs text-green-400 mt-2 inline-block">{stat.change}</span>
                    </div>
                  ))}
                </div>
                {/* Chart placeholder */}
                <div className="glass-card rounded-xl p-6">
                  <h3 className="font-semibold mb-4">{t.totalViews} - Last 7 days</h3>
                  <div className="flex items-end gap-2 h-40">
                    {[
                      Math.min(100, sites.length * 18),
                      Math.min(100, activeSites * 22),
                      Math.min(100, pausedSites * 25),
                      Math.min(100, contacts.length * 16),
                      Math.min(100, newMessages * 25),
                      Math.min(100, projects.length * 18),
                      Math.min(100, totalUsersCount * 12),
                    ].map((h, i) => (
                      <div key={i} className="flex-1 flex flex-col items-center gap-1">
                        <div className="w-full rounded-t-lg bg-gradient-to-t from-green-500/30 to-green-400/60 transition-all hover:from-green-500/50 hover:to-green-400/80" style={{ height: `${h}%` }} />
                        <span className="text-[10px] text-gray-500">{['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][i]}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* ===== PLANS & BILLING ===== */}
            {dashView === 'plans' && (
              <div className="max-w-5xl mx-auto">
                <h1 className="text-2xl font-bold mb-2">{t.plans}</h1>
                <p className="text-gray-400 mb-8">{t.changePlan}</p>
                <div className="grid md:grid-cols-3 gap-5">
                  {(['free', 'premium', 'vip'] as PlanType[]).map(plan => {
                    const cfg = planConfig[plan];
                    const isCurrent = selectedPlan === plan;
                    const features = plan === 'free'
                      ? [t.f1, t.f2, t.f3, t.f4, t.f5, t.fDomain, t.fWatermark]
                      : plan === 'premium'
                      ? [t.p1, t.p2, t.p3, t.p4, t.p5, t.pWatermark]
                      : [t.v1, t.v2, t.v3, t.v4, t.v5, t.v6, t.vNoWatermark];
                    const price = plan === 'free' ? t.freeP : plan === 'premium' ? t.premP : t.vipP;
                    const dur = plan === 'free' ? t.freeD : plan === 'premium' ? t.premD : t.vipD;
                    return (
                      <div key={plan} className={`pricing-card rounded-2xl p-6 ${plan === 'premium' ? 'pricing-card-premium' : plan === 'vip' ? 'pricing-card-vip' : ''} ${isCurrent ? 'ring-2 ring-green-500/50' : ''}`}>
                        <div className="flex items-center gap-3 mb-4">
                          <div className={`w-10 h-10 rounded-xl ${cfg.bgColor} flex items-center justify-center`}>
                            <cfg.icon size={20} className={cfg.color} />
                          </div>
                          <div>
                            <h3 className="font-bold text-lg">{t[plan]}</h3>
                            {isCurrent && <span className="text-[10px] px-2 py-0.5 rounded-full bg-green-500/20 text-green-400">{t.currentPlan}</span>}
                          </div>
                        </div>
                        <div className="mb-4">
                          <span className="text-3xl font-bold">{price}</span>
                          <span className="text-gray-400 text-sm">{dur}</span>
                        </div>
                        <div className={`domain-badge mb-4 ${cfg.bgColor} ${cfg.color}`}>
                          <Link2 size={10} />{cfg.domain}
                        </div>
                        <ul className="space-y-2 mb-6">
                          {features.map((feat, i) => (
                            <li key={i} className="flex items-center gap-2 text-sm text-gray-300">
                              <Check size={14} className={plan === 'vip' ? 'text-yellow-400' : 'text-green-400'} />{feat}
                            </li>
                          ))}
                        </ul>
                        <button
                          onClick={() => { if (plan === 'free') window.open('https://www.youtube.com/@Zerox-i6r', '_blank', 'noopener,noreferrer'); setSelectedPlan(plan); }}
                          className={`w-full py-2.5 rounded-xl font-semibold text-sm transition-all ${isCurrent ? 'bg-green-500/20 text-green-400 border border-green-500/30' : plan === 'premium' ? 'btn-primary text-white' : 'glass text-gray-300 hover:bg-white/10'}`}
                        >
                          {isCurrent ? t.currentPlan : t.selectPlan}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ===== SETTINGS ===== */}
            {dashView === 'settings' && (
              <div className="max-w-5xl mx-auto">
                <h1 className="text-2xl font-bold mb-8">{t.settings}</h1>
                <div className="glass-card rounded-xl p-6 space-y-6">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <h3 className="font-semibold">{t.generalSettings}</h3>
                      <p className="text-xs text-green-400 mt-1">Live profile data from Firebase</p>
                    </div>
                    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${dashboardRole === 'manager' ? 'bg-yellow-500/20 text-yellow-300' : dashboardRole === 'admin' ? 'bg-green-500/20 text-green-300' : 'bg-gray-500/20 text-gray-300'}`}>{dashboardRole}</span>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className="text-sm text-gray-400 mb-2 block">{t.displayName}</label>
                      <input type="text" value={profile?.displayName || user?.displayName || 'User'} readOnly className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none" />
                    </div>
                    <div>
                      <label className="text-sm text-gray-400 mb-2 block">{t.email}</label>
                      <input type="email" value={profile?.email || user?.email || ''} readOnly className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none" />
                    </div>
                    <div>
                      <label className="text-sm text-gray-400 mb-2 block">Firebase UID</label>
                      <input type="text" value={user?.uid || ''} readOnly className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none" />
                    </div>
                    <div>
                      <label className="text-sm text-gray-400 mb-2 block">Account Status</label>
                      <input type="text" value={profile?.status || 'active'} readOnly className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none" />
                    </div>
                  </div>
                  {(dashboardRole === 'manager' || dashboardRole === 'admin') && (
                    <div className="grid gap-3 sm:grid-cols-4">
                      {[
                        { label: 'Total Users', value: totalUsersCount },
                        { label: 'Active Users', value: activeUsersCount },
                        { label: 'Pending Users', value: pendingUsers },
                        { label: 'Sites', value: sites.length },
                        { label: 'Messages', value: contacts.length },
                      ].map(item => (
                        <div key={item.label} className="rounded-xl border border-white/5 bg-white/[0.03] p-4">
                          <p className="text-2xl font-bold text-gradient">{item.value}</p>
                          <p className="text-xs text-gray-400">{item.label}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                {dashboardRole === 'manager' && (
                  <div className="mt-4 glass-card rounded-xl p-6 space-y-4">
                    <h3 className="font-semibold">Public Contact Information</h3>
                    <p className="text-xs text-gray-400">Manager can change the email, phone, and location shown on the website.</p>
                    {contactInfoMsg && <div className="rounded-xl bg-green-500/10 border border-green-500/20 p-3 text-sm text-green-300">{contactInfoMsg}</div>}
                    <div className="grid gap-4 sm:grid-cols-3">
                      <input value={contactInfo.email} onChange={e => setContactInfo(prev => ({ ...prev, email: e.target.value }))} placeholder="Email" className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none focus:border-green-500/50" />
                      <input value={contactInfo.phone} onChange={e => setContactInfo(prev => ({ ...prev, phone: e.target.value }))} placeholder="Phone" className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none focus:border-green-500/50" />
                      <input value={contactInfo.location} onChange={e => setContactInfo(prev => ({ ...prev, location: e.target.value }))} placeholder="Location" className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none focus:border-green-500/50" />
                    </div>
                    <button onClick={saveContactInfo} className="btn-primary rounded-xl px-5 py-2.5 text-sm font-semibold text-white">Save Contact Info</button>
                  </div>
                )}
                {dashboardRole === 'manager' && (
                  <div className="mt-4 glass-card rounded-xl p-6 space-y-4">
                    <h3 className="font-semibold">App Download Links</h3>
                    <p className="text-xs text-gray-400">Manager can set the public APK and Windows 10/11 desktop app download links.</p>
                    {downloadLinksMsg && <div className="rounded-xl bg-green-500/10 border border-green-500/20 p-3 text-sm text-green-300">{downloadLinksMsg}</div>}
                    <div className="grid gap-4 sm:grid-cols-2">
                      <input value={downloadLinks.apk} onChange={e => setDownloadLinks(prev => ({ ...prev, apk: e.target.value }))} placeholder="Android APK download URL" className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none focus:border-green-500/50" />
                      <input value={downloadLinks.windows} onChange={e => setDownloadLinks(prev => ({ ...prev, windows: e.target.value }))} placeholder="Windows 10/11 desktop app URL" className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none focus:border-green-500/50" />
                    </div>
                    <button onClick={saveDownloadLinks} className="btn-primary rounded-xl px-5 py-2.5 text-sm font-semibold text-white">Save Download Links</button>
                  </div>
                )}
                {/* Invite Code (for admins) */}
                {dashboardRole === 'admin' && (
                  <div className="mt-4 p-4 rounded-xl bg-green-500/5 border border-green-500/10">
                    <h4 className="text-sm font-semibold mb-2 flex items-center gap-2"><Link size={14} className="text-green-400" />Use Invite Code</h4>
                    <div className="flex gap-2">
                      <input type="text" value={inviteInput} onChange={e => setInviteInput(e.target.value)} placeholder="kelly-container1234@$" className="flex-1 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm placeholder-gray-500 focus:border-green-500/50 focus:outline-none transition-all" />
                      <button onClick={async () => { try { await useInviteCode(inviteInput); setInviteMsg('Role updated to Admin!'); } catch(e) { setInviteMsg('Invalid code'); } }} className="px-4 py-2 rounded-lg bg-green-500/20 text-green-400 text-sm font-medium hover:bg-green-500/30 transition-all">Apply</button>
                    </div>
                    {inviteMsg && <p className="text-xs mt-2 text-green-400">{inviteMsg}</p>}
                  </div>
                )}
              </div>
            )}

            {/* ===== ADMIN/MANAGER: USER MANAGEMENT ===== */}
            {dashView === 'users' && (dashboardRole === 'manager' || dashboardRole === 'admin') && (
              <div className="max-w-6xl mx-auto">
                <div className="flex items-center justify-between mb-8">
                  <div>
                    <h1 className="text-2xl font-bold">User Management</h1>
                    <p className="text-gray-400 text-sm mt-1">Manage all users, sites, and permissions</p>
                  </div>
                  <button onClick={async () => { const u = await getAllUsers(); setAllUsers(u); const l = await getAllInviteLinks(); setInviteLinks(l); }} className="px-4 py-2 rounded-xl glass text-sm text-gray-300 hover:bg-white/10 transition-all">Refresh</button>
                </div>
                {dashboardRole === 'manager' && (
                  <div className="grid gap-5 mb-6 lg:grid-cols-2">
                    <div className="glass-card rounded-xl p-5">
                      <h3 className="font-semibold mb-3 flex items-center gap-2"><Crown size={16} className="text-yellow-400" />Superadmin Access Form</h3>
                      <p className="text-xs text-gray-400 mb-4">Add a person by email, choose access, and create a passkey if the account is not registered yet.</p>
                      <div className="space-y-3">
                        <input value={inviteName} onChange={e => setInviteName(e.target.value)} placeholder="Full name" className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder-gray-500 outline-none transition-all focus:border-green-500/50" />
                        <input value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} placeholder="user@example.com" className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder-gray-500 outline-none transition-all focus:border-green-500/50" />
                        <input value={invitePassword} onChange={e => setInvitePassword(e.target.value)} type="password" placeholder="Account password" className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder-gray-500 outline-none transition-all focus:border-green-500/50" />
                        <select value={inviteRole} onChange={e => setInviteRole(e.target.value as 'user' | 'admin' | 'manager')} className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none transition-all focus:border-green-500/50">
                          <option className="bg-gray-900" value="user">User access</option>
                          <option className="bg-gray-900" value="admin">Admin access</option>
                          <option className="bg-gray-900" value="manager">Manager access</option>
                        </select>
                        {inviteRole === 'manager' && (
                          <input value={managerAccessKey} onChange={e => setManagerAccessKey(e.target.value)} type="password" placeholder="Manager superadmin key" className="w-full rounded-xl border border-yellow-500/20 bg-yellow-500/5 px-4 py-3 text-sm text-white placeholder-yellow-200/40 outline-none transition-all focus:border-yellow-500/50" />
                        )}
                        <button onClick={createAccessInvite} className="btn-primary w-full rounded-xl px-5 py-3 text-sm font-semibold text-white"><UserPlus size={14} className="inline mr-2" />Add / Generate Access</button>
                      </div>
                    </div>
                    <div className="glass-card rounded-xl p-5">
                      <h3 className="font-semibold mb-3 flex items-center gap-2"><Key size={16} className="text-green-400" />Admin Passkey Generator</h3>
                      <p className="text-xs text-gray-400 mb-4">Generate a passkey for a new admin. Give this code only to trusted admins.</p>
                      <button onClick={generateAdminPasskey} className="btn-primary px-5 py-2.5 rounded-xl text-white text-sm font-semibold flex items-center gap-2">
                        <Sparkles size={14} />Generate Admin Passkey
                      </button>
                      {(generatedInviteKey || generatedCode) && (
                        <div className="mt-4 flex items-center gap-2 rounded-xl border border-green-500/20 bg-green-500/10 px-4 py-3">
                          <code className="text-green-400 text-sm font-mono flex-1 break-all">{generatedInviteKey || generatedCode}</code>
                          <button onClick={() => navigator.clipboard.writeText(generatedInviteKey || generatedCode)} className="p-1.5 rounded-lg hover:bg-white/10 text-green-400 transition-all"><Copy size={14} /></button>
                        </div>
                      )}
                      <div className="mt-6 border-t border-white/5 pt-5">
                        <h4 className="mb-2 text-sm font-semibold text-yellow-300">Reset Manager Key</h4>
                        <div className="flex flex-col gap-2 sm:flex-row">
                          <input value={newManagerKey} onChange={e => setNewManagerKey(e.target.value)} type="password" placeholder="New manager key" className="flex-1 rounded-xl border border-yellow-500/20 bg-yellow-500/5 px-4 py-2.5 text-sm text-white placeholder-yellow-200/40 outline-none focus:border-yellow-500/50" />
                          <button onClick={resetManagerKey} className="rounded-xl bg-yellow-500/20 px-4 py-2.5 text-sm font-semibold text-yellow-300 hover:bg-yellow-500/30">Save Key</button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
                {inviteLinks.length > 0 && (
                  <div className="glass-card rounded-xl p-5 mb-6">
                    <h3 className="font-semibold mb-3 text-sm">Generated Admin Passkeys</h3>
                    <div className="space-y-2">
                      {inviteLinks.map(link => (
                        <div key={link.id} className="flex items-center justify-between p-2 rounded-lg bg-white/3">
                          <code className="text-xs font-mono text-green-400">{link.code}</code>
                          <span className={`text-[10px] px-2 py-0.5 rounded-full ${link.used ? 'bg-gray-500/20 text-gray-400' : 'bg-green-500/20 text-green-400'}`}>{link.used ? 'Used' : 'Active'}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {adminMsg && <div className="mb-4 rounded-xl border border-green-500/20 bg-green-500/10 p-3 text-sm text-green-300">{adminMsg}</div>}
                {/* Users List */}
                <div className="glass-card rounded-xl p-5">
                  <h3 className="font-semibold mb-4">All Users ({totalUsersCount})</h3>
                  {dashboardUsers.length === 0 ? (
                    <p className="text-gray-400 text-sm">No users loaded yet. Click Refresh or publish Firebase rules.</p>
                  ) : (
                    <div className="space-y-2">
                      {dashboardUsers.map(u => (
                        <div key={u.uid} className="flex items-center gap-4 p-3 rounded-xl hover:bg-white/5 transition-all">
                          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center flex-shrink-0">
                            <span className="text-white text-xs font-bold">{(u.displayName || 'U')[0].toUpperCase()}</span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{u.displayName}</p>
                            <p className="text-xs text-gray-400 truncate">{u.email}</p>
                          </div>
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${u.role === 'manager' ? 'bg-yellow-500/20 text-yellow-400' : u.role === 'admin' ? 'bg-green-500/20 text-green-400' : 'bg-gray-500/20 text-gray-400'}`}>{u.role}</span>
                          <span className={`text-[10px] px-2 py-0.5 rounded-full ${u.status === 'active' ? 'bg-green-500/20 text-green-400' : u.status === 'pending' ? 'bg-yellow-500/20 text-yellow-400' : 'bg-red-500/20 text-red-400'}`}>{u.status}</span>
                          <div className="flex flex-wrap justify-end gap-1">
                            {u.status === 'pending' && (
                              <button onClick={async () => { await activateUser(u.uid); const updated = await getAllUsers(); setAllUsers(updated); setAdminMsg('User confirmed and activated.'); }} className="px-2 py-1.5 rounded-lg bg-green-500/10 hover:bg-green-500/20 text-green-400 text-[10px] transition-all" title="Confirm user">Confirm</button>
                            )}
                            {u.role !== 'user' && u.uid !== user?.uid && (
                              <button onClick={() => updateUserAccess(u.uid, 'user')} className="px-2 py-1.5 rounded-lg bg-gray-500/10 hover:bg-gray-500/20 text-gray-300 text-[10px] transition-all" title="Make user">User</button>
                            )}
                            {u.role !== 'admin' && u.uid !== user?.uid && (
                              <button onClick={() => updateUserAccess(u.uid, 'admin')} className="px-2 py-1.5 rounded-lg bg-green-500/10 hover:bg-green-500/20 text-green-400 text-[10px] transition-all" title="Give admin access">Admin</button>
                            )}
                            {u.role !== 'manager' && u.uid !== user?.uid && (
                              <button onClick={() => updateUserAccess(u.uid, 'manager')} className="px-2 py-1.5 rounded-lg bg-yellow-500/10 hover:bg-yellow-500/20 text-yellow-400 text-[10px] transition-all" title="Give manager access">Manager</button>
                            )}
                            {u.status === 'active' ? (
                              <button onClick={async () => { await suspendUser(u.uid); const updated = await getAllUsers(); setAllUsers(updated); }} className="p-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 transition-all" title="Suspend"><Ban size={13} /></button>
                            ) : (
                              <button onClick={async () => { await activateUser(u.uid); const updated = await getAllUsers(); setAllUsers(updated); }} className="p-1.5 rounded-lg bg-green-500/10 hover:bg-green-500/20 text-green-400 transition-all" title="Activate"><UserCheck size={13} /></button>
                            )}
                            {u.uid !== user?.uid && (
                              <button onClick={() => removeUserRecord(u.uid)} className="p-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 transition-all" title="Remove user"><Trash2 size={13} /></button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ===== GET IN TOUCH CHAT (Admin/Manager) ===== */}
            {dashView === 'contacts' && (dashboardRole === 'admin' || dashboardRole === 'manager') && (
              <div className="mx-auto max-w-6xl">
                <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h1 className="text-2xl font-bold">Get In Touch</h1>
                    <p className="mt-1 text-sm text-gray-400">Read user messages, reply like chat, and send notifications.</p>
                  </div>
                  <button onClick={loadContacts} className="rounded-xl px-4 py-2 text-sm text-gray-300 transition-all glass hover:bg-white/10">Refresh</button>
                </div>

                {adminMsg && <div className="mb-4 rounded-xl border border-green-500/20 bg-green-500/10 p-3 text-sm text-green-300">{adminMsg}</div>}

                {dashboardRole === 'manager' && (
                  <div className="mb-6 rounded-xl border border-white/5 bg-white/[0.03] p-5">
                    <h3 className="mb-3 flex items-center gap-2 font-semibold"><Bell size={16} className="text-yellow-400" />Send Notification To Users</h3>
                    <div className="flex flex-col gap-2 sm:flex-row">
                      <input value={notifyText} onChange={e => setNotifyText(e.target.value)} placeholder="Write notification message..." className="flex-1 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder-gray-500 outline-none transition-all focus:border-green-500/50" />
                      <button onClick={sendNotification} disabled={!notifyText.trim()} className="btn-primary rounded-xl px-5 py-3 text-sm font-semibold text-white disabled:opacity-40">Send</button>
                    </div>
                  </div>
                )}

                {contacts.length === 0 ? (
                  <div className="rounded-xl border border-white/5 bg-white/[0.03] p-10 text-center">
                    <MessageSquare size={34} className="mx-auto mb-3 text-gray-600" />
                    <p className="text-gray-400">No contact messages yet.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {contacts.map(c => (
                      <div key={c.id} className="rounded-2xl border border-white/5 bg-white/[0.03] p-5">
                        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                          <div>
                            <div className="flex items-center gap-2">
                              <h3 className="font-semibold">{c.name}</h3>
                              <span className={`rounded-full px-2 py-0.5 text-[10px] ${c.status === 'replied' ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'}`}>{c.status}</span>
                            </div>
                            <p className="text-xs text-gray-400">{c.email} • {c.createdAt}</p>
                          </div>
                        </div>

                        <div className="mb-3 max-w-2xl rounded-2xl rounded-tl-sm bg-white/5 p-3 text-sm text-gray-200">
                          {c.message}
                        </div>
                        {c.reply && (
                          <div className="mb-3 ml-auto max-w-2xl rounded-2xl rounded-tr-sm bg-green-500/15 p-3 text-sm text-green-100">
                            <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-green-400">Manager Reply</p>
                            {c.reply}
                          </div>
                        )}

                        {dashboardRole === 'manager' && (
                          <div className="flex flex-col gap-2 sm:flex-row">
                            <input value={replyDrafts[c.id] || ''} onChange={e => setReplyDrafts(prev => ({ ...prev, [c.id]: e.target.value }))} placeholder="Type reply to this user..." className="flex-1 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder-gray-500 outline-none transition-all focus:border-green-500/50" />
                            <button onClick={() => replyContact(c.id)} disabled={!replyDrafts[c.id]?.trim()} className="btn-primary rounded-xl px-5 py-3 text-sm font-semibold text-white disabled:opacity-40">Reply</button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ===== UPLOAD PROJECTS (Admin/Manager only) ===== */}
            {dashView === 'uploadProjects' && (dashboardRole === 'admin' || dashboardRole === 'manager') && (
              <div className="max-w-5xl mx-auto">
                <h1 className="text-2xl font-bold mb-2">Upload Projects</h1>
                <p className="text-gray-400 text-sm mb-8">Add projects to showcase on the website. Only Admin and Manager can upload.</p>

                {/* Upload Form */}
                <div className="glass-card rounded-xl p-6 mb-8">
                  <h3 className="font-semibold mb-4 flex items-center gap-2"><Plus size={16} className="text-green-400" />New Project</h3>
                  {projectMsg && (
                    <div className="mb-4 p-3 rounded-xl bg-green-500/10 border border-green-500/20 text-sm text-green-300 flex items-center gap-2">
                      <CheckCircle2 size={14} />{projectMsg}
                    </div>
                  )}
                  <div className="grid sm:grid-cols-2 gap-4 mb-4">
                    <div>
                      <label className="text-xs text-gray-400 mb-1 block">Project Title</label>
                      <input type="text" value={newProjectTitle} onChange={e => setNewProjectTitle(e.target.value)} placeholder="My Awesome Project" className="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-500 focus:border-green-500/50 focus:outline-none transition-all text-sm" />
                    </div>
                    <div>
                      <label className="text-xs text-gray-400 mb-1 block">Category</label>
                      <select value={newProjectTag} onChange={e => setNewProjectTag(e.target.value)} className="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white focus:border-green-500/50 focus:outline-none transition-all text-sm">
                        <option value="" className="bg-gray-900">Select category</option>
                        {[t.cat1, t.cat2, t.cat3, t.cat4, t.cat5, t.cat6].map((c, i) => (
                          <option key={i} value={c} className="bg-gray-900">{c}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="mb-4">
                    <label className="text-xs text-gray-400 mb-1 block">Description</label>
                    <textarea value={newProjectDesc} onChange={e => setNewProjectDesc(e.target.value)} placeholder="Describe the project..." rows={2} className="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-500 focus:border-green-500/50 focus:outline-none transition-all text-sm resize-none" />
                  </div>
                  <div className="mb-4">
                    <label className="text-xs text-gray-400 mb-1 block">Project Link</label>
                    <input type="url" value={newProjectLink} onChange={e => setNewProjectLink(e.target.value)} placeholder="https://example.com" className="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-500 focus:border-green-500/50 focus:outline-none transition-all text-sm" />
                    <p className="mt-1 text-[10px] text-gray-500">When users click the project image in Our Projects, this link opens automatically.</p>
                  </div>
                  <div className="mb-4">
                    <label className="text-xs text-gray-400 mb-1 block">Project Image URL</label>
                    <input type="url" value={newProjectImage || ''} onChange={e => setNewProjectImage(e.target.value)} placeholder="https://images.example.com/project.jpg" className="mb-3 w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-500 focus:border-green-500/50 focus:outline-none transition-all text-sm" />
                    <div className="upload-zone rounded-xl p-4 text-center cursor-pointer" onClick={() => { const inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'image/*'; inp.onchange = (e) => { const f = (e.target as HTMLInputElement).files?.[0]; if (f) { const r = new FileReader(); r.onload = (ev) => setNewProjectImage(ev.target?.result as string); r.readAsDataURL(f); } }; inp.click(); }}>
                      {newProjectImage ? (
                        <div className="relative inline-block">
                          <img src={newProjectImage} alt="Preview" className="max-h-32 rounded-lg mx-auto" />
                          <button onClick={e => { e.stopPropagation(); setNewProjectImage(null); }} className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-red-500 flex items-center justify-center"><X size={10} /></button>
                        </div>
                      ) : (
                        <div><Upload size={24} className="text-gray-500 mx-auto mb-2" /><p className="text-gray-400 text-xs">Paste image URL above or click to upload image</p></div>
                      )}
                    </div>
                  </div>
                  <button onClick={uploadProject} disabled={!newProjectTitle.trim()} className="btn-primary px-6 py-2.5 rounded-xl text-white text-sm font-semibold flex items-center gap-2 disabled:opacity-40">
                    <Zap size={14} />Upload Project
                  </button>
                </div>

                {/* Existing Projects */}
                <div className="glass-card rounded-xl p-6">
                  <h3 className="font-semibold mb-4">Uploaded Projects ({projects.length})</h3>
                  {projects.length === 0 ? (
                    <p className="text-gray-500 text-sm text-center py-8">No projects uploaded yet</p>
                  ) : (
                    <div className="space-y-3">
                      {projects.map(p => (
                        <div key={p.id} className="flex items-center gap-4 p-3 rounded-xl bg-white/3 hover:bg-white/5 transition-all">
                          {p.image ? (
                            <button onClick={() => p.link && window.open(p.link, '_blank', 'noopener,noreferrer')} className="flex-shrink-0" title={p.link ? 'Open project link' : 'No project link'}>
                              <img src={p.image} alt="" className="w-14 h-14 rounded-lg object-cover" />
                            </button>
                          ) : (
                            <div className="w-14 h-14 rounded-lg bg-green-500/10 flex items-center justify-center flex-shrink-0"><FolderOpen size={20} className="text-green-400/50" /></div>
                          )}
                          <div className="flex-1 min-w-0">
                            <h4 className="font-medium text-sm truncate">{p.title}</h4>
                            <p className="text-xs text-gray-400 truncate">{p.desc}</p>
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-green-500/10 text-green-400">{p.tag}</span>
                            {p.link && <p className="mt-1 truncate text-[10px] text-blue-400">{p.link}</p>}
                          </div>
                          <button onClick={() => removeProject(p.id)} className="p-2 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 transition-all"><Trash2 size={14} /></button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ===== SELL WEBSITES (Admin/Manager only) ===== */}
            {dashView === 'sellWebsites' && (dashboardRole === 'admin' || dashboardRole === 'manager') && (
              <div className="max-w-6xl mx-auto">
                <h1 className="text-2xl font-bold mb-2">Upload Website For Sale</h1>
                <p className="text-gray-400 text-sm mb-8">Manager and Admin can upload ready websites that appear publicly in Buy Website.</p>
                <button onClick={() => setDashView('youtubeAds')} className="mb-6 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-2 text-sm font-semibold text-red-300 hover:bg-red-500/20">Push YouTube Video Ad</button>
                {saleMsg && <div className={`mb-5 rounded-xl border p-3 text-sm ${saleMsg.includes('Could not') ? 'border-red-500/20 bg-red-500/10 text-red-300' : 'border-green-500/20 bg-green-500/10 text-green-300'}`}>{saleMsg}</div>}
                <div className="grid gap-6 lg:grid-cols-2">
                  <div className="glass-card rounded-xl p-6">
                    <h3 className="mb-4 flex items-center gap-2 font-semibold"><ShoppingCart size={16} className="text-green-400" />New Website Listing</h3>
                    <div className="space-y-4">
                      <input value={saleTitle} onChange={e => setSaleTitle(e.target.value)} placeholder="Website title" className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder-gray-500 outline-none focus:border-green-500/50" />
                      <textarea value={saleDesc} onChange={e => setSaleDesc(e.target.value)} placeholder="Describe the website for buyers..." rows={3} className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder-gray-500 outline-none focus:border-green-500/50 resize-none" />
                      <div className="grid gap-3 sm:grid-cols-2">
                        <select value={saleCategory} onChange={e => setSaleCategory(e.target.value)} className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none focus:border-green-500/50">
                          <option value="" className="bg-gray-900">Category</option>
                          {[t.cat1, t.cat2, t.cat3, t.cat4, t.cat5, t.cat6].map(c => <option key={c} value={c} className="bg-gray-900">{c}</option>)}
                        </select>
                        <input value={salePrice} onChange={e => setSalePrice(e.target.value)} placeholder="Price e.g. $120" className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder-gray-500 outline-none focus:border-green-500/50" />
                      </div>
                      <input type="url" value={saleImage} onChange={e => setSaleImage(e.target.value)} placeholder="Image URL" className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder-gray-500 outline-none focus:border-green-500/50" />
                      <input type="url" value={saleLink} onChange={e => setSaleLink(e.target.value)} placeholder="Demo / buy link" className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder-gray-500 outline-none focus:border-green-500/50" />
                      <div>
                        <label className="mb-2 block text-xs text-gray-400">Choose where this website appears</label>
                        <div className="grid grid-cols-3 gap-2">
                          {[
                            { id: 'sale' as const, label: 'Websites For Sale' },
                            { id: 'project' as const, label: 'Our Projects' },
                            { id: 'both' as const, label: 'Both' },
                          ].map(option => (
                            <button key={option.id} onClick={() => setSaleDestination(option.id)} className={`rounded-xl border px-3 py-2 text-xs font-semibold transition-all ${saleDestination === option.id ? 'border-green-500/50 bg-green-500/15 text-green-300' : 'border-white/10 bg-white/5 text-gray-400 hover:bg-white/10'}`}>{option.label}</button>
                          ))}
                        </div>
                      </div>
                      <button onClick={uploadSaleWebsite} disabled={!saleTitle.trim() || !salePrice.trim()} className="btn-primary w-full rounded-xl px-5 py-3 text-sm font-semibold text-white disabled:opacity-40">Upload</button>
                    </div>
                  </div>
                  <div className="glass-card rounded-xl p-6">
                    <h3 className="mb-4 font-semibold">Websites For Sale ({publicBuyWebsites.length})</h3>
                    <div className="space-y-3 max-h-[520px] overflow-y-auto pr-1">
                      {publicBuyWebsites.length === 0 ? <p className="py-10 text-center text-sm text-gray-500">No websites for sale yet.</p> : publicBuyWebsites.map(item => (
                        <div key={item.id} className="flex items-center gap-4 rounded-xl bg-white/[0.03] p-3">
                          {item.image ? <img src={item.image} alt={item.title} className="h-16 w-16 rounded-lg object-cover" /> : <div className="h-16 w-16 rounded-lg bg-green-500/10 flex items-center justify-center"><ShoppingCart size={20} className="text-green-400" /></div>}
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-semibold">{item.title}</p>
                            <p className="truncate text-xs text-gray-400">{item.category} - {item.price}</p>
                          </div>
                          <button onClick={() => removeSaleWebsite(item.id)} className="rounded-lg bg-red-500/10 p-2 text-red-400 hover:bg-red-500/20"><Trash2 size={14} /></button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ===== YOUTUBE ADS (Manager only) ===== */}
            {dashView === 'youtubeAds' && dashboardRole === 'manager' && (
              <div className="max-w-5xl mx-auto">
                <h1 className="text-2xl font-bold mb-2">YouTube Video Ads</h1>
                <p className="text-gray-400 text-sm mb-8">Paste a YouTube video URL. It will display on the home page like an ad.</p>
                {youtubeMsg && <div className={`mb-5 rounded-xl border p-3 text-sm ${youtubeMsg.includes('valid') || youtubeMsg.includes('did not') || youtubeMsg.includes('Could not') ? 'border-red-500/20 bg-red-500/10 text-red-300' : 'border-green-500/20 bg-green-500/10 text-green-300'}`}>{youtubeMsg}</div>}
                <div className="grid gap-6 lg:grid-cols-2">
                  <div className="glass-card rounded-xl p-6">
                    <h3 className="mb-4 flex items-center gap-2 font-semibold"><Monitor size={16} className="text-red-400" />New YouTube Ad</h3>
                    <div className="space-y-4">
                      <input value={newYouTubeTitle} onChange={e => setNewYouTubeTitle(e.target.value)} placeholder="Ad title" className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder-gray-500 outline-none focus:border-red-500/50" />
                      <input value={newYouTubeUrl} onChange={e => setNewYouTubeUrl(e.target.value)} placeholder="https://www.youtube.com/watch?v=..." className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder-gray-500 outline-none focus:border-red-500/50" />
                      <button onClick={uploadYouTubeAd} disabled={!newYouTubeUrl.trim()} className="w-full rounded-xl bg-red-500 px-5 py-3 text-sm font-semibold text-white hover:bg-red-600 disabled:opacity-40">Add To Home Page</button>
                    </div>
                  </div>
                  <div className="glass-card rounded-xl p-6">
                    <h3 className="mb-4 font-semibold">Current YouTube Ads ({youtubeAds.length})</h3>
                    <div className="space-y-3 max-h-[520px] overflow-y-auto pr-1">
                      {youtubeAds.length === 0 ? <p className="py-10 text-center text-sm text-gray-500">No YouTube ads yet.</p> : youtubeAds.map(ad => (
                        <div key={ad.id} className="rounded-xl bg-white/[0.03] p-3">
                          <div className="aspect-video overflow-hidden rounded-lg bg-black mb-3">
                            <iframe className="h-full w-full" src={`https://www.youtube.com/embed/${ad.videoId}`} title={ad.title} allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen />
                          </div>
                          <div className="flex items-center justify-between gap-3">
                            <div className="min-w-0">
                              <p className="truncate text-sm font-semibold">{ad.title}</p>
                              <p className="truncate text-xs text-gray-500">{ad.url}</p>
                            </div>
                            <button onClick={() => removeYouTubeAd(ad.id)} className="rounded-lg bg-red-500/10 p-2 text-red-400 hover:bg-red-500/20"><Trash2 size={14} /></button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ===================== LOADING =====================
  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-green-500 to-green-600 flex items-center justify-center mx-auto mb-4 green-glow animate-pulse">
            <span className="text-white font-bold text-xl">W</span>
          </div>
          <div className="w-6 h-6 border-2 border-green-500/30 border-t-green-500 rounded-full animate-spin mx-auto" />
        </div>
      </div>
    );
  }

  // ===================== LOGIN PAGE =====================
  if (showLogin || (showDashboard && !user)) {
    return <LoginPage onBack={() => { setShowLogin(false); setShowDashboard(false); }} />;
  }

  // ===================== MAIN WEBSITE =====================
  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white bg-mesh">
      {/* NAVBAR / SIDEBAR */}
      {scrolled ? (
        <>
          <div className="fixed left-0 top-0 h-full z-50 hidden md:flex flex-col items-center py-6 px-3 glass-strong" style={{ width: '72px' }}>
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-green-500 to-green-600 flex items-center justify-center mb-8 cursor-pointer green-glow" onClick={() => navigate('home')}>
              <span className="text-white font-bold text-lg">W</span>
            </div>
            <div className="flex flex-col items-center gap-2 flex-1">
              {navItems.map(item => (
                <button key={item.id} onClick={() => navigate(item.id)} className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all duration-300 group relative ${activeSection === item.id ? 'bg-green-500/20 text-green-400' : 'text-gray-400 hover:text-green-400 hover:bg-white/5'}`}>
                  <item.icon size={20} />
                  <span className="absolute left-full ml-3 px-3 py-1.5 rounded-lg glass text-sm text-white opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50">{item.label}</span>
                </button>
              ))}
            </div>
            <button onClick={() => openDashboard()} className="w-12 h-12 rounded-xl flex items-center justify-center transition-all duration-300 mb-2 text-gray-400 hover:text-green-400 hover:bg-white/5">
              <LayoutDashboard size={20} />
            </button>
            <div className="relative" ref={langRef}>
              <button onClick={() => setLangOpen(!langOpen)} className="w-12 h-12 rounded-xl flex items-center justify-center text-gray-400 hover:text-green-400 hover:bg-white/5 transition-all">
                <Globe size={20} />
              </button>
              {langOpen && (
                <div className="absolute left-full bottom-0 ml-3 glass-strong rounded-xl p-2 min-w-[160px] z-50">
                  {langOptions.map(l => (
                    <button key={l.code} onClick={() => { setLang(l.code); setLangOpen(false); }} className={`w-full text-left px-3 py-2 rounded-lg text-sm flex items-center gap-2 transition-all ${lang === l.code ? 'bg-green-500/20 text-green-400' : 'text-gray-300 hover:bg-white/5'}`}>
                      <span>{l.flag}</span><span>{l.label}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
          <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 glass-strong px-2 py-2 flex items-center justify-around">
            {navItems.slice(0, 4).map(item => (
              <button key={item.id} onClick={() => navigate(item.id)} className={`flex flex-col items-center gap-0.5 p-1.5 rounded-lg transition-all ${activeSection === item.id ? 'text-green-400' : 'text-gray-400'}`}>
                <item.icon size={16} /><span className="text-[9px]">{item.label}</span>
              </button>
            ))}
            <button onClick={() => openDashboard()} className="flex flex-col items-center gap-0.5 p-1.5 rounded-lg text-gray-400">
              <LayoutDashboard size={16} /><span className="text-[9px]">{t.dashboard}</span>
            </button>
          </div>
        </>
      ) : (
        <nav className="fixed top-0 left-0 right-0 z-50 glass">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-16">
              <div className="flex items-center gap-3 cursor-pointer" onClick={() => navigate('home')}>
                <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-green-500 to-green-600 flex items-center justify-center green-glow">
                  <span className="text-white font-bold">W</span>
                </div>
                <span className="text-white font-bold text-xl hidden sm:block">{t.brand}</span>
              </div>
              <div className="hidden md:flex items-center gap-1">
                {navItems.map(item => (
                  <button key={item.id} onClick={() => navigate(item.id)} className={`nav-link px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeSection === item.id ? 'text-green-400 bg-green-500/10' : 'text-gray-300 hover:text-green-400'}`}>
                    {item.label}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => user ? openDashboard() : setShowLogin(true)} className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-gray-300 hover:text-green-400 hover:bg-white/5 transition-all">
                  <LayoutDashboard size={16} /><span className="hidden sm:inline">{t.dashboard}</span>
                </button>
                {user ? (
                  <button onClick={logout} className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-gray-300 hover:text-red-400 hover:bg-white/5 transition-all">
                    <LogOut size={16} /><span className="hidden sm:inline">Logout</span>
                  </button>
                ) : (
                  <button onClick={() => setShowLogin(true)} className="btn-primary px-4 py-2 rounded-lg text-white text-sm font-medium flex items-center gap-2">
                    <UserPlus size={14} /><span className="hidden sm:inline">Login</span>
                  </button>
                )}
                <div className="relative" ref={langRef}>
                  <button onClick={() => setLangOpen(!langOpen)} className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-gray-300 hover:text-green-400 hover:bg-white/5 transition-all">
                    <Globe size={16} /><span className="hidden sm:inline">{currentLang.flag} {currentLang.label}</span>
                    <ChevronDown size={14} className={`transition-transform ${langOpen ? 'rotate-180' : ''}`} />
                  </button>
                  {langOpen && (
                    <div className="absolute right-0 top-full mt-2 glass-strong rounded-xl p-2 min-w-[180px] z-50">
                      {langOptions.map(l => (
                        <button key={l.code} onClick={() => { setLang(l.code); setLangOpen(false); }} className={`w-full text-left px-3 py-2.5 rounded-lg text-sm flex items-center gap-3 transition-all ${lang === l.code ? 'bg-green-500/20 text-green-400' : 'text-gray-300 hover:bg-white/5'}`}>
                          <span className="text-lg">{l.flag}</span><span>{l.label}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <button onClick={() => setMobileOpen(!mobileOpen)} className="md:hidden p-2 rounded-lg text-gray-300 hover:text-green-400 hover:bg-white/5 transition-all">
                  {mobileOpen ? <X size={20} /> : <Menu size={20} />}
                </button>
              </div>
            </div>
          </div>
          {mobileOpen && (
            <div className="md:hidden glass-strong border-t border-white/5">
              <div className="px-4 py-3 space-y-1">
                {navItems.map(item => (
                  <button key={item.id} onClick={() => { navigate(item.id); setMobileOpen(false); }} className={`w-full text-left px-4 py-3 rounded-lg text-sm flex items-center gap-3 transition-all ${activeSection === item.id ? 'bg-green-500/20 text-green-400' : 'text-gray-300 hover:bg-white/5'}`}>
                    <item.icon size={18} />{item.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </nav>
      )}

      {/* MAIN CONTENT */}
      <div className={scrolled ? 'md:ml-[72px]' : ''}>
        {/* HERO / HOME */}
        <section id="home" className="relative min-h-screen flex items-center justify-center overflow-hidden pt-16">
          <div className="absolute top-20 left-10 w-72 h-72 bg-green-500/10 rounded-full blur-[120px] animate-float" />
          <div className="absolute bottom-20 right-10 w-96 h-96 bg-emerald-500/8 rounded-full blur-[150px] animate-float-delay" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-green-500/5 rounded-full blur-[200px]" />
          <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass mb-8 animate-pulse-green">
              <Zap size={14} className="text-green-400" />
              <span className="text-sm text-green-300">{t.brand} - #1 Website Builder</span>
            </div>
            <h1 className="text-4xl sm:text-5xl md:text-7xl font-bold mb-6 leading-tight">
              <span className="text-white">{t.heroTitle.split(' ').slice(0, -1).join(' ')} </span>
              <span className="text-gradient">{t.heroTitle.split(' ').slice(-1)}</span>
            </h1>
            <p className="text-gray-400 text-lg sm:text-xl max-w-2xl mx-auto mb-10 leading-relaxed">{t.heroSub}</p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <button onClick={() => openDashboard('create')} className="btn-primary px-8 py-4 rounded-xl text-white font-semibold flex items-center gap-2">
                {t.getStarted} <ArrowRight size={18} />
              </button>
              <button onClick={() => { const el = document.getElementById('pricing'); if (el) el.scrollIntoView({ behavior: 'smooth' }); }} className="px-8 py-4 rounded-xl glass text-white font-semibold hover:bg-white/10 transition-all flex items-center gap-2">
                {t.viewPricing} <ChevronRight size={18} />
              </button>
              <button onClick={() => setShowDownloadPanel(true)} className="px-8 py-4 rounded-xl glass text-white font-semibold hover:bg-white/10 transition-all flex items-center gap-2">
                <Download size={18} /> Download App
              </button>
            </div>

            {showDownloadPanel && (
              <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm" onClick={() => setShowDownloadPanel(false)}>
                <div className="w-full max-w-lg rounded-3xl border border-white/10 bg-[#07110b]/95 p-6 text-left shadow-2xl shadow-green-500/10" onClick={e => e.stopPropagation()}>
                  <div className="mb-5 flex items-center justify-between">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.25em] text-green-400">WebCraft App</p>
                      <h3 className="mt-1 text-2xl font-bold text-white">Choose Your Download</h3>
                    </div>
                    <button onClick={() => setShowDownloadPanel(false)} className="rounded-xl p-2 text-gray-400 hover:bg-white/10 hover:text-white"><X size={18} /></button>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <button disabled={!downloadLinks.apk} onClick={() => downloadLinks.apk && window.open(downloadLinks.apk, '_blank', 'noopener,noreferrer')} className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 text-left transition hover:border-green-500/40 disabled:cursor-not-allowed disabled:opacity-50">
                      <Smartphone size={28} className="mb-3 text-green-400" />
                      <p className="font-bold text-white">Android APK</p>
                      <p className="mt-1 text-xs text-gray-400">Install on Android phone.</p>
                      <span className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-green-300"><Download size={14} />{downloadLinks.apk ? 'Download APK' : 'Coming soon'}</span>
                    </button>
                    <button disabled={!downloadLinks.windows} onClick={() => downloadLinks.windows && window.open(downloadLinks.windows, '_blank', 'noopener,noreferrer')} className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 text-left transition hover:border-green-500/40 disabled:cursor-not-allowed disabled:opacity-50">
                      <Laptop size={28} className="mb-3 text-green-400" />
                      <p className="font-bold text-white">Windows 10/11</p>
                      <p className="mt-1 text-xs text-gray-400">Desktop app installer.</p>
                      <span className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-green-300"><Download size={14} />{downloadLinks.windows ? 'Download Desktop' : 'Coming soon'}</span>
                    </button>
                  </div>
                  <p className="mt-4 text-xs text-gray-500">Manager controls these links from Dashboard &gt; Settings.</p>
                </div>
              </div>
            )}

            {youtubeAds.length > 0 && (
              <div className="mx-auto mt-16 max-w-4xl text-left">
                <div className="mb-4 flex items-center gap-2">
                  <div className="rounded-full bg-red-500/15 px-3 py-1 text-xs font-bold text-red-300">YouTube Ad</div>
                  <p className="text-sm text-gray-400">Promoted video from manager</p>
                </div>
                <div className="overflow-hidden rounded-3xl border border-white/10 bg-black shadow-2xl shadow-red-500/10">
                  <div className="aspect-video">
                    <iframe className="h-full w-full" src={`https://www.youtube.com/embed/${youtubeAds[0].videoId}`} title={youtubeAds[0].title} allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen />
                  </div>
                  <div className="p-4">
                    <h3 className="font-bold text-white">{youtubeAds[0].title}</h3>
                    <button onClick={() => window.open(youtubeAds[0].url, '_blank', 'noopener,noreferrer')} className="mt-2 inline-flex items-center gap-2 text-sm font-semibold text-red-300 hover:text-red-200"><ExternalLink size={14} />Open on YouTube</button>
                  </div>
                </div>
              </div>
            )}

            {/* PRICING */}
            <div className="mt-24 mb-16" id="pricing">
              <h2 className="text-3xl sm:text-4xl font-bold mb-4">{t.pricingTitle}</h2>
              <p className="text-gray-400 max-w-xl mx-auto mb-12">{t.pricingSub}</p>
              <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
                {/* FREE */}
                <div className="pricing-card rounded-2xl p-6 sm:p-8 text-left">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-xl bg-gray-500/20 flex items-center justify-center"><Shield size={20} className="text-gray-400" /></div>
                    <div><h3 className="font-bold text-lg">{t.free}</h3><span className="text-xs px-2 py-0.5 rounded-full bg-gray-500/20 text-gray-400">{t.trial}</span></div>
                  </div>
                  <div className="mb-4"><span className="text-4xl font-bold">{t.freeP}</span><span className="text-gray-400 text-sm">{t.freeD}</span></div>
                  <div className="domain-badge mb-5 bg-gray-500/15 text-gray-400"><Link2 size={10} />.edgeone.app / .netlify.app</div>
                  <ul className="space-y-3 mb-8">
                    {[t.f1, t.f2, t.f3, t.f4, t.f5, t.fDomain, t.fWatermark].map((feat, i) => (
                      <li key={i} className="flex items-center gap-3 text-sm text-gray-300">
                        {i === 1 ? <X size={16} className="text-red-400" /> : i === 6 ? <span className="text-amber-400"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg></span> : <Check size={16} className="text-green-400" />}
                        <span className={i === 1 ? 'text-red-300/70 line-through' : i === 6 ? 'text-amber-300/80' : ''}>{feat}</span>
                      </li>
                    ))}
                  </ul>
                  <button onClick={() => { window.open('https://www.youtube.com/@Zerox-i6r', '_blank', 'noopener,noreferrer'); setSelectedPlan('free'); openDashboard('plans'); }} className={`w-full py-3 rounded-xl font-semibold transition-all text-center ${selectedPlan === 'free' ? 'bg-green-500/20 text-green-400 border border-green-500/30' : 'glass text-gray-300 hover:bg-white/10'}`}>Subscribe YouTube & Choose</button>
                </div>
                {/* PREMIUM */}
                <div className="pricing-card pricing-card-premium pricing-popular rounded-2xl p-6 sm:p-8 text-left relative">
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2"><span className="px-4 py-1 rounded-full bg-gradient-to-r from-green-500 to-emerald-500 text-white text-xs font-bold">{t.mostPopular}</span></div>
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-xl bg-green-500/20 flex items-center justify-center"><Star size={20} className="text-green-400" /></div>
                    <div><h3 className="font-bold text-lg">{t.premium}</h3><span className="text-xs px-2 py-0.5 rounded-full bg-green-500/20 text-green-400">{t.mostPopular}</span></div>
                  </div>
                  <div className="mb-4"><span className="text-4xl font-bold text-gradient">{t.premP}</span><span className="text-gray-400 text-sm">{t.premD}</span></div>
                  <div className="domain-badge mb-5 bg-green-500/15 text-green-400"><Link2 size={10} />.com</div>
                  <ul className="space-y-3 mb-8">
                    {[t.p1, t.p2, t.p3, t.p4, t.p5, t.pWatermark].map((feat, i) => (
                      <li key={i} className="flex items-center gap-3 text-sm text-gray-300">
                        {i === 5 ? <span className="text-amber-400"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg></span> : <Check size={16} className="text-green-400" />}
                        <span className={i === 5 ? 'text-amber-300/80' : ''}>{feat}</span>
                      </li>
                    ))}
                  </ul>
                  <button onClick={() => { setSelectedPlan('premium'); openDashboard('plans'); }} className={`w-full py-3 rounded-xl font-semibold transition-all text-center btn-primary ${selectedPlan === 'premium' ? 'ring-2 ring-green-400' : ''}`}>{t.choosePlan}</button>
                </div>
                {/* VIP */}
                <div className="pricing-card pricing-card-vip rounded-2xl p-6 sm:p-8 text-left">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-xl bg-yellow-500/20 flex items-center justify-center"><Crown size={20} className="text-yellow-400" /></div>
                    <div><h3 className="font-bold text-lg">{t.vip}</h3><span className="text-xs px-2 py-0.5 rounded-full bg-yellow-500/20 text-yellow-400">{t.bestValue}</span></div>
                  </div>
                  <div className="mb-4"><span className="text-4xl font-bold">{t.vipP}</span><span className="text-gray-400 text-sm">{t.vipD}</span></div>
                  <div className="domain-badge mb-5 bg-yellow-500/15 text-yellow-400"><Link2 size={10} />.com / .rw</div>
                  <ul className="space-y-3 mb-8">
                    {[t.v1, t.v2, t.v3, t.v4, t.v5, t.v6, t.vNoWatermark].map((feat, i) => (
                      <li key={i} className={`flex items-center gap-3 text-sm ${i === 6 ? 'text-green-300' : 'text-gray-300'}`}><Check size={16} className={i === 6 ? 'text-green-400' : 'text-yellow-400'} />{feat}</li>
                    ))}
                  </ul>
                  <button onClick={() => { setSelectedPlan('vip'); openDashboard('plans'); }} className={`w-full py-3 rounded-xl font-semibold transition-all text-center ${selectedPlan === 'vip' ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30' : 'glass text-gray-300 hover:bg-white/10'}`}>{t.choosePlan}</button>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* PROJECTS */}
        <section id="projects" className="py-24 relative">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
              <h2 className="text-3xl sm:text-4xl font-bold mb-4">{t.projectsTitle}</h2>
              <p className="text-gray-400 max-w-xl mx-auto">{t.projectsSub}</p>
              <p className="mt-3 text-xs text-green-400">Public page: everyone can view projects without login.</p>
            </div>
            <div className="mx-auto mb-10 max-w-xl">
              <label className="mb-2 flex items-center gap-2 text-xs text-gray-400"><Search size={14} />Search projects</label>
              <input value={projectSearch} onChange={e => setProjectSearch(e.target.value)} placeholder="Search by title, category, or description..." className="w-full rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-sm text-white placeholder-gray-500 outline-none transition-all focus:border-green-500/50" />
            </div>
            {visibleProjects.length === 0 ? (
              <div className="text-center py-16">
                <div className="w-20 h-20 rounded-2xl bg-white/3 flex items-center justify-center mx-auto mb-4">
                  <FolderOpen size={36} className="text-gray-600" />
                </div>
                <p className="text-gray-500 text-lg mb-2">{projects.length === 0 ? 'No projects yet' : 'No projects found'}</p>
                <p className="text-gray-600 text-sm">{projects.length === 0 ? 'Projects will appear here once uploaded by Admin or Manager.' : 'Try another search word.'}</p>
              </div>
            ) : (
              <>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {displayedProjects.map((project) => (
                  <div key={project.id} className="glass-card rounded-2xl overflow-hidden group cursor-pointer">
                    <button
                      onClick={() => project.link && window.open(project.link, '_blank', 'noopener,noreferrer')}
                      className="h-48 w-full bg-gradient-to-br from-green-500/20 to-emerald-500/10 flex items-center justify-center relative overflow-hidden"
                      title={project.link ? 'Open project' : project.title}
                    >
                      {project.image ? (
                        <img src={project.image} alt={project.title} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                      ) : (
                        <>
                          <div className="absolute inset-0 bg-gradient-to-br from-green-500/10 to-transparent group-hover:from-green-500/20 transition-all" />
                          <Smartphone size={48} className="text-green-400/30 group-hover:text-green-400/50 transition-all group-hover:scale-110" />
                        </>
                      )}
                    </button>
                    <div className="p-5">
                      <span className="text-xs px-2 py-1 rounded-full bg-green-500/10 text-green-400">{project.tag}</span>
                      <h3 className="text-lg font-bold mt-3">{project.title}</h3>
                      <p className="text-gray-400 text-sm mt-1">{project.desc}</p>
                      {project.link && <button onClick={() => window.open(project.link, '_blank', 'noopener,noreferrer')} className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-green-400 hover:text-green-300"><ExternalLink size={12} />Open project</button>}
                    </div>
                  </div>
                ))}
              </div>
              {visibleProjects.length > 6 && (
                <div className="mt-10 text-center">
                  <button onClick={() => setShowAllProjects(prev => !prev)} className="rounded-xl border border-green-500/30 bg-green-500/10 px-6 py-3 text-sm font-semibold text-green-300 transition hover:bg-green-500/20">
                    {showAllProjects ? 'Show Less' : 'More Projects'}
                  </button>
                </div>
              )}
              </>
            )}
          </div>
        </section>

        {/* BUY */}
        <section id="buy" className="py-24 relative">
          <div className="absolute top-0 right-0 w-96 h-96 bg-green-500/5 rounded-full blur-[150px]" />
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
            <div className="text-center mb-16">
              <h2 className="text-3xl sm:text-4xl font-bold mb-4">{t.buyTitle}</h2>
              <p className="text-gray-400 max-w-xl mx-auto">{t.buySub}</p>
              <p className="mt-3 text-xs text-green-400">Public page: everyone can view website categories and pricing without login.</p>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
              {categories.map((cat) => (
                <button key={cat.id} onClick={() => setSelectedCategory(cat.id)} className={`glass-card rounded-2xl p-6 text-left ${selectedCategory === cat.id ? 'ring-2 ring-green-500 bg-green-500/10' : ''}`}>
                  <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${cat.color} flex items-center justify-center mb-4`}>
                    <cat.icon size={24} className="text-white" />
                  </div>
                  <h3 className="font-bold text-lg">{cat.label}</h3>
                  <p className="text-gray-400 text-sm mt-1">{t.selectCat}</p>
                  {selectedCategory === cat.id && (
                    <div className="mt-3 flex items-center gap-2 text-green-400 text-sm font-medium"><Check size={16} /> Selected</div>
                  )}
                </button>
              ))}
            </div>
            <div className="mb-12">
              <div className="mb-6 text-center">
                <h3 className="text-2xl font-bold">Websites For Sale</h3>
                <p className="mt-2 text-sm text-gray-400">Loaded directly from Firebase database.</p>
              </div>
              {publicBuyWebsites.length === 0 ? (
                <div className="rounded-2xl border border-white/5 bg-white/[0.03] p-10 text-center">
                  <ShoppingCart size={34} className="mx-auto mb-3 text-gray-600" />
                  <p className="text-gray-500">Firebase has no sale listings yet. Upload from Manager/Admin after publishing rulus.html rules.</p>
                </div>
              ) : (
                <>
                <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                  {displayedBuyWebsites.map(item => (
                    <div key={item.id} className="glass-card overflow-hidden rounded-2xl">
                      <button onClick={() => item.link && window.open(item.link, '_blank', 'noopener,noreferrer')} className="h-44 w-full bg-green-500/10 flex items-center justify-center overflow-hidden">
                        {item.image ? <img src={item.image} alt={item.title} className="h-full w-full object-cover transition-transform duration-500 hover:scale-110" /> : <ShoppingCart size={40} className="text-green-400/40" />}
                      </button>
                      <div className="p-5">
                        <div className="mb-2 flex items-center justify-between gap-2">
                          <span className="rounded-full bg-green-500/10 px-2 py-1 text-xs text-green-400">{item.category}</span>
                          <span className="font-bold text-green-300">{item.price}</span>
                        </div>
                        <h4 className="font-bold">{item.title}</h4>
                        <p className="mt-1 line-clamp-2 text-sm text-gray-400">{item.desc}</p>
                        {item.link && <button onClick={() => window.open(item.link, '_blank', 'noopener,noreferrer')} className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-green-400 hover:text-green-300"><ExternalLink size={14} />Open / Buy</button>}
                      </div>
                    </div>
                  ))}
                </div>
                {publicBuyWebsites.length > 6 && (
                  <div className="mt-10 text-center">
                    <button onClick={() => setShowAllBuyWebsites(prev => !prev)} className="rounded-xl border border-green-500/30 bg-green-500/10 px-6 py-3 text-sm font-semibold text-green-300 transition hover:bg-green-500/20">
                      {showAllBuyWebsites ? 'Show Less' : 'More Websites'}
                    </button>
                  </div>
                )}
                </>
              )}
            </div>
            {selectedCategory && (
              <div className="text-center">
                <button onClick={() => openDashboard('create')} className="btn-primary px-10 py-4 rounded-xl text-white font-semibold text-lg flex items-center gap-3 mx-auto">
                  {t.startBuild} <ArrowRight size={20} />
                </button>
              </div>
            )}
          </div>
        </section>

        {/* ABOUT */}
        <section id="about" className="py-24 relative">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid lg:grid-cols-2 gap-12 items-center">
              <div>
                <h2 className="text-3xl sm:text-4xl font-bold mb-4">{t.aboutTitle}</h2>
                <p className="text-green-400 text-lg mb-6">{t.aboutSub}</p>
                <p className="text-gray-400 leading-relaxed mb-8">{t.aboutDesc}</p>
                <div className="grid grid-cols-2 gap-4">
                  {[{ value: '10K+', label: 'Users' }, { value: '50K+', label: 'Websites' }, { value: '99.9%', label: 'Uptime' }, { value: '24/7', label: 'Support' }].map((stat, i) => (
                    <div key={i} className="glass-card rounded-xl p-4 text-center">
                      <p className="text-2xl font-bold text-gradient">{stat.value}</p>
                      <p className="text-gray-400 text-sm mt-1">{stat.label}</p>
                    </div>
                  ))}
                </div>
              </div>
              <div className="relative">
                <div className="glass-card rounded-2xl p-8">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="h-32 rounded-xl bg-gradient-to-br from-green-500/20 to-emerald-500/10 flex items-center justify-center"><Code size={32} className="text-green-400" /></div>
                    <div className="h-32 rounded-xl bg-gradient-to-br from-emerald-500/20 to-teal-500/10 flex items-center justify-center"><Palette size={32} className="text-emerald-400" /></div>
                    <div className="h-32 rounded-xl bg-gradient-to-br from-teal-500/20 to-cyan-500/10 flex items-center justify-center"><Globe size={32} className="text-teal-400" /></div>
                    <div className="h-32 rounded-xl bg-gradient-to-br from-green-400/20 to-lime-500/10 flex items-center justify-center"><Sparkles size={32} className="text-lime-400" /></div>
                  </div>
                </div>
                <div className="absolute -top-4 -right-4 w-24 h-24 bg-green-500/10 rounded-full blur-[40px]" />
                <div className="absolute -bottom-4 -left-4 w-32 h-32 bg-emerald-500/10 rounded-full blur-[50px]" />
              </div>
            </div>
          </div>
        </section>

        {/* CONTACT */}
        <section id="contact" className="py-24 relative">
          <div className="absolute bottom-0 left-0 w-96 h-96 bg-green-500/5 rounded-full blur-[150px]" />
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
            <div className="text-center mb-16">
              <h2 className="text-3xl sm:text-4xl font-bold mb-4">{t.contactTitle}</h2>
              <p className="text-gray-400 max-w-xl mx-auto">{t.contactSub}</p>
            </div>
            <div className="grid lg:grid-cols-2 gap-12">
              <div className="glass-card rounded-2xl p-6 sm:p-8">
                <form className="space-y-5" onSubmit={submitContact}>
                  {adminMsg && <div className="rounded-xl border border-green-500/20 bg-green-500/10 p-3 text-sm text-green-300">{adminMsg}</div>}
                  <div>
                    <label className="text-sm text-gray-400 mb-2 block">{t.name}</label>
                    <input type="text" value={contactName} onChange={e => setContactName(e.target.value)} className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-500 focus:border-green-500/50 focus:outline-none focus:ring-1 focus:ring-green-500/30 transition-all" placeholder="John Doe" />
                  </div>
                  <div>
                    <label className="text-sm text-gray-400 mb-2 block">{t.email}</label>
                    <input type="email" value={contactEmail} onChange={e => setContactEmail(e.target.value)} className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-500 focus:border-green-500/50 focus:outline-none focus:ring-1 focus:ring-green-500/30 transition-all" placeholder="john@example.com" />
                  </div>
                  <div>
                    <label className="text-sm text-gray-400 mb-2 block">{t.msg}</label>
                    <textarea rows={4} value={contactMessage} onChange={e => setContactMessage(e.target.value)} className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-500 focus:border-green-500/50 focus:outline-none focus:ring-1 focus:ring-green-500/30 transition-all resize-none" placeholder="..." />
                  </div>
                  <button disabled={!contactName.trim() || !contactEmail.trim() || !contactMessage.trim()} className="btn-primary w-full py-3 rounded-xl text-white font-semibold flex items-center justify-center gap-2 disabled:opacity-40">{t.send} <Send size={16} /></button>
                </form>
              </div>
              <div className="space-y-6">
                {[
                  { icon: MapPin, title: 'Location', info: contactInfo.location },
                  { icon: Mail, title: 'Email', info: contactInfo.email },
                  { icon: Phone, title: 'Phone', info: contactInfo.phone },
                ].map((item, i) => (
                  <div key={i} className="glass-card rounded-xl p-5 flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-green-500/10 flex items-center justify-center flex-shrink-0"><item.icon size={20} className="text-green-400" /></div>
                    <div><p className="text-sm text-gray-400">{item.title}</p><p className="font-medium">{item.info}</p></div>
                  </div>
                ))}
                <div className="glass-card rounded-xl p-5 h-48 flex items-center justify-center">
                  <div className="text-center"><MapPin size={32} className="text-green-400 mx-auto mb-2" /><p className="text-gray-400 text-sm">{contactInfo.location}</p></div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* FOOTER */}
        <footer className="py-8 border-t border-white/5">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-green-500 to-green-600 flex items-center justify-center"><span className="text-white font-bold text-xs">W</span></div>
              <span className="text-gray-400 text-sm">&copy; 2026 {t.brand}. All rights reserved.</span>
            </div>
            <div className="flex items-center gap-4 text-gray-500 text-sm">
              <span>Made with <span className="text-green-400">{'\u2665'}</span> in Rwanda</span>
            </div>
          </div>
        </footer>
      </div>

      {/* AI Chat - always visible */}
      <AIChat />
      <VoiceAI
        onDashboard={() => openDashboard('overview')}
        onLogin={() => setShowLogin(true)}
        onNavigate={navigate}
        onCreateSite={() => openDashboard('create')}
        onPlans={() => openDashboard('plans')}
        isLoggedIn={!!user}
      />
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
