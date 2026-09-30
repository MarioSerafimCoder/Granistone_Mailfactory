import type { BrandSettings } from '@/types/campaign';

export const GRANISTONE_UNSUBSCRIBE_URL =
  'http://clickemailmkt.granistone.com.br/ls/click?upn=u001.HYrFDadV03mEVZ2LPqnNZbtXDZGmWc6vDpdCZ5AdTf61-2BgH70ABIismgpfrjT6W6eLNM25F0FqhXuzMnOlb8SqATsL56lJ0jQLHuWNgzcRO2GF22qzRTmgQftXBYtib49AEGS-2BN-2Faqha1Rb9jkKHUulIgg5vIrFiCsHPkaP7GUEYlmr32HIIFIFtlEEmb-2FVKdo-2F1uwdqOHK7mqGJ0zVwEd5wsF90ba4ZGU0NoVekwxoPhpL5q6RneVWGji3Ua2Yzxe-2BXHuLhqxpPR5F6YxYeIA-3D-3DNJiY_mX7stDELalGpySLa2-2Bsp5X2ozzvxSzdiooXkzqvXd4vtC1BUgVyboX85zqjTmDzRrjNB6kU2akjZ8ymhLYuB-2Fy2soYKHwcT4OZTxB4itArMEIUlYd2HYtNbrRLkjtaVgzMq17EaeazwCemmCp5KAR4s5wQgAG2V5Gu-2Fyk-2FUCqfYpWh33XY4I07fepfLff4bxw3LRnxf9kfe8H2AuuihONhqQfJyBh28X-2B29yu0tYnEg1F1rUo-2BcgJzHtjckblO8MaAzeDJC-2FCn-2Byylk1yn0IJoM81KHz7ADJhzMjFu3AjBUId8b-2BMkgQHSp-2FlYk6Rf-2FpbaijhM49mfIo4aJzjL-2FBSgL-2FJg4mBEOrskU3LFVHFNqwJoWMXuU1xq0DsDPBIUxlS8gwoAko7kDMzCQUaJ7BTfEuHKpf1mqqqKDC4PZwwkqbnLLl8c-2Fem-2FlFtqDx70FN6WsnbASeuMrpyNb-2FGuk-2BEnwe4ThhMnxLUlJOlzqWTqxkKAveb4pipVvWcFIqU52uRcUHvmAoypsMtditIHThQu-2FisMB0gnmawdLNLQNzQNmvukkDJAjfCDQ2DTt3r4OWBHziXNPwxKQpMsAY-2B-2BO4Jp0UdQTvaib3rRO9-2BPn8pXlu0CjHPo4l2z5pUHyNDFpru43pVdmddU9D-2Bc1-2BWhP5rU5cxig-2FsFKRVIsNEfDL1WsTdKKIWsMQNO6DZmmRY1O73BtiR1d7Cv-2BaigaVTK5CmA-3D-3D';

/** Central brand defaults shared by every email template. */
export const granistoneConfig: BrandSettings = {
  brandName: 'Granistone A Rocha',
  email: '',
  assetBaseUrl: '',
  logoUrl: '',
  facebook: 'https://www.facebook.com/granistonearocha',
  instagram: 'https://www.instagram.com/granistonearocha/',
  website: 'https://www.granistone.com.br/',
  whatsapp: 'https://wa.me/5585986221574',
  unsubscribeUrl: GRANISTONE_UNSUBSCRIBE_URL,
  address: 'R. Vicente Linhares, 500 - Aldeota, 60135-270 - Fortaleza - Ceará, Brasil',
  phone: '+55 85 98622-1574',
};
