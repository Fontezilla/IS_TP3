import { ApolloProvider } from '@apollo/client/react';
import client from '../lib/graphql';
import { ApolloWrapper } from './ApolloWrapper';

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt">
      <body>
        <ApolloWrapper>
          {children}
        </ApolloWrapper>
      </body>
    </html>
  );
}
