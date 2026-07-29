import { Helmet } from "react-helmet-async";

interface SEOProps {
  title: string;
  description: string;
  path: string;
  noIndex?: boolean;
}

const SITE = "https://dailygap.lovable.app";

export const SEO = ({ title, description, path, noIndex }: SEOProps) => {
  const url = `${SITE}${path}`;
  return (
    <Helmet>
      <title>{title}</title>
      <meta name="description" content={description} />
      <link rel="canonical" href={url} />
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={url} />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
      {noIndex && <meta name="robots" content="noindex,follow" />}
    </Helmet>
  );
};
